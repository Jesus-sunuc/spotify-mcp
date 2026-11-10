"""HTTP API for the web front-end. Reuses the Spotify client and tools from server.py.

Run:  .venv/bin/uvicorn api:app --host localhost --port 8000 --reload
"""

import asyncio
import re
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field, field_validator
from spotipy.exceptions import SpotifyException

import db
import party
import player
import releases
import server  # same Spotify login / token cache as the MCP server
import tasks


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init()
    alarms = asyncio.create_task(tasks.alarm_loop())
    party_queue = asyncio.create_task(tasks.party_loop())
    yield
    alarms.cancel()
    party_queue.cancel()
    tasks.sleep_timer.cancel()
    tasks.ab_loop.cancel()


app = FastAPI(title="spotify-mcp web API", lifespan=lifespan)


# ---------- errors ----------

@app.exception_handler(SpotifyException)
async def spotify_error(_: Request, e: SpotifyException):
    status = e.http_status if 400 <= (e.http_status or 0) < 600 else 502
    return JSONResponse({"error": e.msg}, status_code=status)


@app.exception_handler(party.PartyError)
async def party_error(_: Request, e: party.PartyError):
    return JSONResponse({"error": str(e)}, status_code=e.status)


@app.exception_handler(RuntimeError)
async def runtime_error(_: Request, e: RuntimeError):
    # e.g. "Not logged in" or "No Spotify device found"
    return JSONResponse({"error": str(e)}, status_code=409)


# ---------- helpers (UI needs ids + images, which the MCP tools leave out) ----------

def _img(images: list | None) -> str | None:
    return images[0]["url"] if images else None


def _track(t: dict) -> dict:
    return {
        "uri": t["uri"],
        "name": t["name"],
        "artists": ", ".join(a["name"] for a in t["artists"]),
        "album": t["album"]["name"],
        "image": _img(t["album"].get("images")),
        "duration_ms": t.get("duration_ms"),
    }


def _artist(a: dict) -> dict:
    return {"uri": a["uri"], "name": a["name"], "genres": a.get("genres", []), "image": _img(a.get("images"))}


def _playlist(p: dict) -> dict:
    total = (p.get("items") or p.get("tracks") or {}).get("total")  # field renamed in Feb 2026 API
    return {
        "uri": p["uri"],
        "name": p["name"],
        "owner": p["owner"].get("display_name") or p["owner"]["id"],
        "tracks": total,
        "image": _img(p.get("images")),
    }


# ---------- read ----------

@app.get("/api/now-playing")
def now_playing():
    cur = server.sp().current_playback()
    if not cur or not cur.get("item"):
        return {"is_playing": False, "track": None, "device": cur["device"]["name"] if cur else None}
    return {
        "is_playing": cur["is_playing"],
        "progress_ms": cur.get("progress_ms"),
        "track": _track(cur["item"]),
        "device": cur["device"]["name"],
    }


@app.get("/api/top-artists")
def top_artists(time_range: str = "medium_term", limit: int = 12):
    res = server.sp().current_user_top_artists(limit=min(limit, 50), time_range=time_range)
    return [_artist(a) for a in res["items"]]


@app.get("/api/search")
def search(q: str, type: str = "track", limit: int = 10):
    if type not in ("track", "artist", "playlist"):
        return JSONResponse({"error": "type must be track, artist or playlist"}, status_code=400)
    res = server.sp().search(q=q, type=type, limit=min(limit, 10))  # Spotify max is 10 since Feb 2026
    items = [x for x in res[f"{type}s"]["items"] if x]  # null entries = items hidden from dev apps
    return [{"track": _track, "artist": _artist, "playlist": _playlist}[type](x) for x in items]


# ---------- actions (reuse server.py tools) ----------

class PlayBody(BaseModel):
    uris: list[str] | None = None  # track URIs
    context_uri: str | None = None  # spotify:artist:/playlist:/album:


@app.post("/api/play")
def play(body: PlayBody):
    """Tracks, an artist/playlist/album context, or resume when the body is empty. Plays on the selected device."""
    return player.play(uris=body.uris, context_uri=body.context_uri)


@app.post("/api/pause")
def pause():
    return server.pause()


class QueueBody(BaseModel):
    uris: list[str]


@app.post("/api/queue")
def queue(body: QueueBody):
    return player.queue(body.uris)


# ---------- devices ----------

@app.get("/api/devices")
def devices():
    selected = player.selected_device_name()
    return [
        {
            "name": d["name"],
            "type": d["type"],
            "is_active": d["is_active"],
            "volume_percent": d.get("volume_percent"),
            "selected": d["name"] == selected,
        }
        for d in player.devices()
    ]


class DeviceBody(BaseModel):
    name: str


@app.put("/api/devices/selected")
def select_device(body: DeviceBody):
    return player.select_device(body.name)


# ---------- sleep timer ----------

class SleepBody(BaseModel):
    minutes: int = Field(ge=1, le=240)


@app.get("/api/sleep")
def sleep_status():
    return tasks.sleep_timer.status()


@app.post("/api/sleep")
async def sleep_start(body: SleepBody):  # async: the timer task must live on the server's event loop
    return tasks.sleep_timer.start(body.minutes)


@app.delete("/api/sleep")
async def sleep_cancel():
    return tasks.sleep_timer.cancel()


# ---------- A-B loop ----------

class LoopBody(BaseModel):
    a_ms: int = Field(ge=0)
    b_ms: int = Field(gt=0)


@app.get("/api/loop")
def loop_status():
    return tasks.ab_loop.status()


@app.post("/api/loop")
async def loop_start(body: LoopBody):  # async: the loop task must live on the server's event loop
    return await tasks.ab_loop.start(body.a_ms, body.b_ms)


@app.delete("/api/loop")
async def loop_stop():
    return tasks.ab_loop.cancel()


# ---------- new releases ----------

@app.get("/api/releases")
def new_releases(refresh: bool = False):
    """Albums/singles from your top artists released in the last 90 days. Cached for 6 hours."""
    return releases.get(refresh=refresh)


# ---------- party jukebox (host side; guests use guest_api.py) ----------

@app.get("/api/party")
def party_state():
    code = party.active_code()
    return {
        "active": bool(code),
        "url": party.guest_url(),
        "host": party.host_address(),
        "port": party.GUEST_PORT,
        "songs": party.songs(code) if code else [],
    }


@app.post("/api/party")
def party_start():
    party.start()
    return party_state()


@app.delete("/api/party")
def party_end():
    party.end()
    return party_state()


class PartyHostBody(BaseModel):
    host: str = Field(min_length=1, max_length=253, pattern=r"^[A-Za-z0-9.\-]+$")


@app.put("/api/party/host")
def party_host(body: PartyHostBody):
    party.set_host_address(body.host)
    return party_state()


@app.delete("/api/party/songs/{song_id}", status_code=204)
def party_remove_song(song_id: int):
    if not party.set_status(song_id, "removed"):
        raise HTTPException(404, "Song not found")


@app.get("/api/party/qr.svg")
def party_qr():
    import segno  # only needed here

    url = party.guest_url()
    if not url:
        raise HTTPException(404, "Start a party and set your Mac's address first")
    svg = segno.make(url, error="m").svg_inline(scale=8, border=2, dark="#000", light="#fff")
    return Response(svg, media_type="image/svg+xml", headers={"Cache-Control": "no-store"})


# ---------- alarms ----------

class AlarmBody(BaseModel):
    time: str  # 'HH:MM'
    days: list[int] = []  # 0=Mon..6=Sun; empty = one-off
    uri: str
    label: str
    target_volume: int = Field(40, ge=5, le=100)
    ramp_minutes: int = Field(10, ge=0, le=60)

    @field_validator("time")
    @classmethod
    def _time(cls, v: str) -> str:
        if not re.fullmatch(r"([01]\d|2[0-3]):[0-5]\d", v):
            raise ValueError("time must be HH:MM (24h)")
        return v

    @field_validator("days")
    @classmethod
    def _days(cls, v: list[int]) -> list[int]:
        if any(d not in range(7) for d in v):
            raise ValueError("days must be 0 (Mon) to 6 (Sun)")
        return v

    @field_validator("uri")
    @classmethod
    def _uri(cls, v: str) -> str:
        if not re.fullmatch(r"spotify:(track|album|artist|playlist):[A-Za-z0-9]+", v):
            raise ValueError("uri must be a Spotify track, album, artist or playlist URI")
        return v


class AlarmPatch(BaseModel):
    enabled: bool


@app.get("/api/alarms")
def alarms():
    return db.list_alarms()


@app.post("/api/alarms", status_code=201)
def create_alarm(body: AlarmBody):
    return db.create_alarm(**body.model_dump())


@app.patch("/api/alarms/{alarm_id}")
def update_alarm(alarm_id: int, body: AlarmPatch):
    # Re-enabling clears last_fired so a one-off alarm can ring again today.
    alarm = db.update_alarm(alarm_id, enabled=int(body.enabled), **({"last_fired": None} if body.enabled else {}))
    if not alarm:
        raise HTTPException(404, "Alarm not found")
    return alarm


@app.delete("/api/alarms/{alarm_id}", status_code=204)
def delete_alarm(alarm_id: int):
    if not db.delete_alarm(alarm_id):
        raise HTTPException(404, "Alarm not found")


@app.post("/api/alarms/{alarm_id}/test")
async def test_alarm(alarm_id: int):
    """Ring now with a 1-minute volume ramp, so you can check the device and volume."""
    alarm = db.get_alarm(alarm_id)
    if not alarm:
        raise HTTPException(404, "Alarm not found")
    return await tasks.wake_up(alarm, ramp_minutes=1)
