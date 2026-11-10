"""HTTP API for the web front-end. Reuses the Spotify client and tools from server.py.

Run:  .venv/bin/uvicorn api:app --host 127.0.0.1 --port 8000 --reload
"""

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from spotipy.exceptions import SpotifyException

import server  # same Spotify login / token cache as the MCP server

app = FastAPI(title="spotify-mcp web API")


# ---------- errors ----------

@app.exception_handler(SpotifyException)
async def spotify_error(_: Request, e: SpotifyException):
    status = e.http_status if 400 <= (e.http_status or 0) < 600 else 502
    return JSONResponse({"error": e.msg}, status_code=status)


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
    """Tracks, an artist/playlist/album context, or resume when the body is empty."""
    if body.context_uri:
        server.sp().start_playback(device_id=server._device_id(), context_uri=body.context_uri)
        return {"playing": True}
    return server.play(track_uris=body.uris)


@app.post("/api/pause")
def pause():
    return server.pause()


class QueueBody(BaseModel):
    uris: list[str]


@app.post("/api/queue")
def queue(body: QueueBody):
    return server.queue_tracks(body.uris)
