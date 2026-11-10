"""Guest-facing party API + page, served on the local network (port 5176 on the host).

Deliberately tiny: guests can only see the party, search songs, add songs and vote.
Everything else (playback, devices, alarms...) lives in api.py, which is bound to localhost only.

Run:  .venv/bin/uvicorn guest_api:app --host 0.0.0.0 --port 8000
"""

import re
import threading
import time
from collections import OrderedDict, defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import unquote

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from spotipy.exceptions import SpotifyException

import db
import party
import server

DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init()
    yield


# No /docs or /openapi.json: guests don't need a map of the API.
app = FastAPI(title="spotify-mcp party (guests)", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


@app.exception_handler(party.PartyError)
async def party_error(_: Request, e: party.PartyError):
    return JSONResponse({"error": str(e)}, status_code=e.status)


@app.exception_handler(SpotifyException)
async def spotify_error(_: Request, e: SpotifyException):
    return JSONResponse({"error": "Spotify is having trouble right now. Try again in a moment."}, status_code=502)


# ---------- guest identity + limits ----------

class Guest(BaseModel):
    id: str
    name: str
    code: str


def guest(
    x_party_code: str = Header(""),
    x_guest_id: str = Header(""),
    x_guest_name: str = Header("Guest"),
) -> Guest:
    code = party.check_code(x_party_code)
    if not re.fullmatch(r"[A-Za-z0-9\-]{8,64}", x_guest_id):
        raise HTTPException(400, "Missing guest id. Reload the page.")
    # Header values are latin-1 on the wire; the page URI-encodes the nickname so accents survive.
    name = re.sub(r"\s+", " ", unquote(x_guest_name)).strip()[:24] or "Guest"
    return Guest(id=x_guest_id, name=name, code=code)


class RateLimit:
    """Sliding-window limiter. Keys are guest ids (all guests share one IP behind Docker's port mapping)."""

    def __init__(self, limit: int, per_seconds: float, message: str):
        self.limit, self.per, self.message = limit, per_seconds, message
        self.hits: dict[str, deque] = defaultdict(deque)
        self.lock = threading.Lock()

    def check(self, key: str) -> None:
        now = time.monotonic()
        with self.lock:
            q = self.hits[key]
            while q and now - q[0] > self.per:
                q.popleft()
            if len(q) >= self.limit:
                raise HTTPException(429, self.message)
            q.append(now)


search_per_guest = RateLimit(10, 60, "Slow down a little. Try searching again in a minute.")
search_everyone = RateLimit(60, 60, "Lots of people are searching. Try again in a minute.")  # protects the Spotify quota
adds_per_guest = RateLimit(5, 600, "You've added a lot of songs. Give it a few minutes.")
votes_per_guest = RateLimit(40, 60, "Easy on the votes!")


# ---------- shared caches (many phones polling shouldn't mean many Spotify calls) ----------

_np_cache: dict = {"at": 0.0, "value": None}
_np_lock = threading.Lock()


def _now_playing() -> dict | None:
    with _np_lock:
        if time.monotonic() - _np_cache["at"] > 5:
            cur = server.sp().current_playback()
            item = cur.get("item") if cur else None
            _np_cache["value"] = (
                {
                    "name": item["name"],
                    "artists": ", ".join(a["name"] for a in item["artists"]),
                    "image": item["album"]["images"][0]["url"] if item["album"].get("images") else None,
                    "is_playing": cur["is_playing"],
                }
                if item
                else None
            )
            _np_cache["at"] = time.monotonic()
        return _np_cache["value"]


# Tracks guests have seen in search results. Adding only accepts these, so guests can't inject arbitrary
# URIs or fake titles, and we don't need another Spotify call to look the track up.
_seen_tracks: OrderedDict[str, dict] = OrderedDict()
_seen_lock = threading.Lock()


def _remember(track: dict) -> None:
    with _seen_lock:
        _seen_tracks[track["uri"]] = track
        _seen_tracks.move_to_end(track["uri"])
        while len(_seen_tracks) > 5000:
            _seen_tracks.popitem(last=False)


# ---------- API ----------

@app.get("/guest-api/state")
def state(g: Guest = Depends(guest)):
    return {"now_playing": _now_playing(), "songs": party.songs(g.code, g.id), "you": g.name}


@app.get("/guest-api/search")
def search(q: str, g: Guest = Depends(guest)):
    q = q.strip()[:100]
    if not q:
        return []
    search_per_guest.check(g.id)
    search_everyone.check("all")
    res = server.sp().search(q=q, type="track", limit=10)
    out = []
    for t in res["tracks"]["items"]:
        if not t:
            continue
        track = {
            "uri": t["uri"],
            "name": t["name"],
            "artists": ", ".join(a["name"] for a in t["artists"]),
            "image": t["album"]["images"][-1]["url"] if t["album"].get("images") else None,  # smallest
            "duration_ms": t.get("duration_ms"),
        }
        _remember(track)
        out.append(track)
    return out


class AddBody(BaseModel):
    uri: str


@app.post("/guest-api/songs", status_code=201)
def add(body: AddBody, g: Guest = Depends(guest)):
    with _seen_lock:
        track = _seen_tracks.get(body.uri)
    if not track:
        raise HTTPException(400, "Search for the song first, then add it from the results.")
    adds_per_guest.check(g.id)
    return party.add_song(g.code, track, g.id, g.name)


@app.put("/guest-api/songs/{song_id}/vote", status_code=204)
def vote(song_id: int, g: Guest = Depends(guest)):
    votes_per_guest.check(g.id)
    party.vote(g.code, song_id, g.id, up=True)


@app.delete("/guest-api/songs/{song_id}/vote", status_code=204)
def unvote(song_id: int, g: Guest = Depends(guest)):
    votes_per_guest.check(g.id)
    party.vote(g.code, song_id, g.id, up=False)


# ---------- the guest page (built by `npm run build` in frontend/) ----------

if (DIST / "assets").is_dir():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")


@app.get("/")
def page():
    page = DIST / "guest.html"
    if not page.is_file():
        return HTMLResponse("<p>Guest page not built yet. Run <code>npm run build</code> in frontend/.</p>", 503)
    return FileResponse(page, headers={"Cache-Control": "no-cache"})
