"""Background jobs that run inside the API process: sleep timer and wake-up alarms.

Spotify calls are blocking (spotipy/requests), so they run via asyncio.to_thread.
Note: `uvicorn --reload` restarts the process on code changes, which cancels a running sleep timer.
Alarms live in SQLite, so they survive restarts.
"""

import asyncio
import logging
from datetime import datetime, timedelta

import db
import party
import player
import server

log = logging.getLogger("tasks")


# ---------- sleep timer ----------

class SleepTimer:
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self.ends_at: datetime | None = None
        self.fade_minutes = 0

    def status(self) -> dict:
        active = self._task is not None and not self._task.done()
        return {
            "active": active,
            "ends_at": self.ends_at.isoformat() if active and self.ends_at else None,
            "fade_minutes": self.fade_minutes if active else 0,
        }

    def start(self, minutes: int) -> dict:
        self.cancel()
        self.fade_minutes = min(5, minutes)  # fade during the last 5 minutes (or the whole timer if shorter)
        self.ends_at = datetime.now().astimezone() + timedelta(minutes=minutes)
        self._task = asyncio.create_task(self._run())
        return self.status()

    def cancel(self) -> dict:
        if self._task and not self._task.done():
            self._task.cancel()
        self._task = None
        return self.status()

    async def _run(self) -> None:
        assert self.ends_at
        fade_seconds = self.fade_minutes * 60
        wait = (self.ends_at - datetime.now().astimezone()).total_seconds() - fade_seconds
        await asyncio.sleep(max(0, wait))

        cur = await asyncio.to_thread(server.sp().current_playback)
        if not cur or not cur.get("is_playing"):
            return  # nothing to fade
        dev = cur["device"]
        original = dev.get("volume_percent") or 50
        try:
            await player.ramp_volume(dev["id"], original, 0, fade_seconds)
            await asyncio.to_thread(server.sp().pause_playback, device_id=dev["id"])
            log.info("sleep timer: paused %s", dev["name"])
        finally:
            # Restore the volume so the next play isn't silent (also runs if the timer is cancelled mid-fade).
            await asyncio.to_thread(player.set_volume, original, dev["id"])


sleep_timer = SleepTimer()


# ---------- A-B loop ----------

class ABLoop:
    """Repeat the section [a_ms, b_ms) of the current track by seeking back to A when playback reaches B.

    Seeks go through Spotify's servers, so expect roughly ±0.5-1s precision (more on smart speakers).
    """

    SEEK_EARLY_S = 0.25  # seek slightly before B to make up for network latency
    RESYNC_S = 5  # re-read the real position this long before B so drift doesn't build up

    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self.a_ms = self.b_ms = 0
        self.track: dict | None = None
        self.stopped_reason: str | None = None

    def status(self) -> dict:
        active = self._task is not None and not self._task.done()
        return {
            "active": active,
            "a_ms": self.a_ms if active else None,
            "b_ms": self.b_ms if active else None,
            "track_uri": self.track["uri"] if active and self.track else None,
            "stopped_reason": None if active else self.stopped_reason,
        }

    async def start(self, a_ms: int, b_ms: int) -> dict:
        cur = await asyncio.to_thread(server.sp().current_playback)
        if not cur or not cur.get("item"):
            raise RuntimeError("Nothing is playing. Start a song first.")
        duration = cur["item"]["duration_ms"]
        if not (0 <= a_ms < b_ms <= duration):
            raise RuntimeError("A must be before B, and both inside the song.")
        if b_ms - a_ms < 2000:
            raise RuntimeError("Make the loop at least 2 seconds long.")
        self.cancel()
        self.a_ms, self.b_ms, self.stopped_reason = a_ms, b_ms, None
        self.track = {"uri": cur["item"]["uri"], "device_id": cur["device"]["id"]}
        await asyncio.to_thread(server.sp().seek_track, a_ms, device_id=self.track["device_id"])
        self._task = asyncio.create_task(self._run())
        return self.status()

    def cancel(self, reason: str = "stopped") -> dict:
        if self._task and not self._task.done():
            self._task.cancel()
            self.stopped_reason = reason
        self._task = None
        return self.status()

    async def _seek_a(self) -> None:
        await asyncio.to_thread(server.sp().seek_track, self.a_ms, device_id=self.track["device_id"])
        await asyncio.sleep(1)  # let the device report the new position before reading it again

    async def _run(self) -> None:
        try:
            while True:
                cur = await asyncio.to_thread(server.sp().current_playback)
                if not cur or not cur.get("item") or cur["item"]["uri"] != self.track["uri"]:
                    self.stopped_reason = "the song changed"
                    return
                if not cur.get("is_playing"):
                    self.stopped_reason = "playback was paused"
                    return
                pos = cur["progress_ms"]
                if pos >= self.b_ms or pos < self.a_ms - 2000:  # past B, or someone seeked before A
                    await self._seek_a()
                    continue
                wait = (self.b_ms - pos) / 1000
                if wait > self.RESYNC_S + 1:
                    await asyncio.sleep(wait - self.RESYNC_S)  # sleep most of the way, then re-sync
                    continue
                await asyncio.sleep(max(0, wait - self.SEEK_EARLY_S))
                await self._seek_a()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            log.exception("A-B loop failed")
            self.stopped_reason = f"error: {e}"


ab_loop = ABLoop()


# ---------- party jukebox ----------

QUEUE_AHEAD_MS = 25_000  # queue the top-voted song this long before the current one ends


async def party_loop() -> None:
    """While a party is on, add the most-voted guest song to Spotify's queue near the end of each track."""
    queued_during: str | None = None  # track URI we already queued after (one pick per track)
    while True:
        delay = 10.0
        try:
            code = await asyncio.to_thread(party.active_code)
            cur = await asyncio.to_thread(server.sp().current_playback) if code else None
            if code and cur and cur.get("is_playing") and cur.get("item"):
                uri = cur["item"]["uri"]
                remaining = cur["item"]["duration_ms"] - cur["progress_ms"]
                if remaining <= QUEUE_AHEAD_MS and queued_during != uri:
                    queued_during = uri
                    song = await asyncio.to_thread(party.pop_top, code)
                    if song:
                        try:
                            await asyncio.to_thread(server.sp().add_to_queue, song["uri"], device_id=cur["device"]["id"])
                            log.info("party: queued %s (%s votes)", song["name"], song["votes"])
                        except Exception:
                            await asyncio.to_thread(party.set_status, song["id"], "pending")  # put it back
                            raise
                    delay = max(2, remaining / 1000 + 2)  # wait for the next track to start
                else:
                    delay = min(10, max(2, (remaining - QUEUE_AHEAD_MS) / 1000))
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("party loop failed")
        await asyncio.sleep(delay)


# ---------- wake-up alarms ----------

ALARM_CHECK_SECONDS = 20
ALARM_GRACE_MINUTES = 2  # still fire if the check runs a little late
START_VOLUME = 5


def _is_due(alarm: dict, now: datetime) -> bool:
    if not alarm["enabled"] or alarm["last_fired"] == now.date().isoformat():
        return False
    if alarm["days"] and now.weekday() not in alarm["days"]:
        return False
    hh, mm = map(int, alarm["time"].split(":"))
    due = now.replace(hour=hh, minute=mm, second=0, microsecond=0)
    return due <= now < due + timedelta(minutes=ALARM_GRACE_MINUTES)


async def wake_up(alarm: dict, ramp_minutes: int | None = None) -> dict:
    """Start the alarm's music quietly on the selected device, then raise the volume to the target."""
    dev = await asyncio.to_thread(player.resolve_device)
    try:
        # Lower first so it doesn't start at yesterday's volume. Some idle devices reject this, hence the retry below.
        await asyncio.to_thread(player.set_volume, START_VOLUME, dev["id"])
    except Exception:
        pass
    await asyncio.to_thread(player.play, None, alarm["uri"], dev)
    await asyncio.to_thread(player.set_volume, START_VOLUME, dev["id"])
    minutes = alarm["ramp_minutes"] if ramp_minutes is None else ramp_minutes
    asyncio.create_task(player.ramp_volume(dev["id"], START_VOLUME, alarm["target_volume"], minutes * 60))
    log.info("alarm %s: playing %s on %s", alarm["id"], alarm["label"], dev["name"])
    return {"playing": alarm["label"], "device": dev["name"]}


async def alarm_loop() -> None:
    while True:
        try:
            now = datetime.now().astimezone()
            for alarm in await asyncio.to_thread(db.list_alarms):
                if _is_due(alarm, now):
                    # Mark first so a slow or failing Spotify call can't fire it twice.
                    fields = {"last_fired": now.date().isoformat()}
                    if not alarm["days"]:
                        fields["enabled"] = 0  # one-off alarm
                    await asyncio.to_thread(lambda: db.update_alarm(alarm["id"], **fields))
                    await wake_up(alarm)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("alarm check failed")  # keep the loop alive
        await asyncio.sleep(ALARM_CHECK_SECONDS)
