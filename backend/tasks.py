"""Background jobs that run inside the API process: sleep timer and wake-up alarms.

Spotify calls are blocking (spotipy/requests), so they run via asyncio.to_thread.
Note: `uvicorn --reload` restarts the process on code changes, which cancels a running sleep timer.
Alarms live in SQLite, so they survive restarts.
"""

import asyncio
import logging
from datetime import datetime, timedelta

import db
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
