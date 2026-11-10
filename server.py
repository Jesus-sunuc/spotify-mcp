"""Minimal Spotify MCP server for the spotify-dj Claude Code agent.

Run once in a terminal to log in:   .venv/bin/python server.py auth
After that Claude Code launches it over stdio (no arguments).
"""

import os
import sys
from pathlib import Path

import spotipy
from dotenv import load_dotenv
from mcp.server.mcpserver import MCPServer
from spotipy.oauth2 import SpotifyOAuth

HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")

SCOPES = " ".join(
    [
        "user-top-read",
        "user-read-recently-played",
        "playlist-modify-private",
        "playlist-modify-public",
        "user-read-playback-state",
        "user-modify-playback-state",
    ]
)


def _auth_manager(open_browser: bool) -> SpotifyOAuth:
    return SpotifyOAuth(
        client_id=os.environ["SPOTIPY_CLIENT_ID"],
        client_secret=os.environ["SPOTIPY_CLIENT_SECRET"],
        redirect_uri=os.environ.get("SPOTIPY_REDIRECT_URI", "http://127.0.0.1:8888/callback"),
        scope=SCOPES,
        # Token cache lives next to this file (chmod 600 after first login).
        cache_handler=spotipy.CacheFileHandler(cache_path=str(HERE / ".spotify_token_cache")),
        open_browser=open_browser,
    )


_sp: spotipy.Spotify | None = None


def sp() -> spotipy.Spotify:
    """Lazy client. Never opens a browser: under stdio MCP that would hang the server."""
    global _sp
    if _sp is None:
        am = _auth_manager(open_browser=False)
        if am.cache_handler.get_cached_token() is None:
            raise RuntimeError("Not logged in to Spotify. Run: .venv/bin/python server.py auth")
        _sp = spotipy.Spotify(auth_manager=am)
    return _sp


def _track(t: dict) -> dict:
    return {
        "uri": t["uri"],
        "name": t["name"],
        "artists": ", ".join(a["name"] for a in t["artists"]),
        "album": t["album"]["name"],
        "year": (t["album"].get("release_date") or "")[:4],
    }


mcp = MCPServer("spotify")


@mcp.tool()
def top_tracks(time_range: str = "medium_term", limit: int = 30) -> list[dict]:
    """User's most-played tracks. time_range: short_term (~4 weeks), medium_term (~6 months), long_term (years)."""
    res = sp().current_user_top_tracks(limit=min(limit, 50), time_range=time_range)
    return [_track(t) for t in res["items"]]


@mcp.tool()
def top_artists(time_range: str = "medium_term", limit: int = 30) -> list[dict]:
    """User's most-played artists with their genres. time_range as in top_tracks."""
    res = sp().current_user_top_artists(limit=min(limit, 50), time_range=time_range)
    return [{"name": a["name"], "genres": a.get("genres", [])} for a in res["items"]]


@mcp.tool()
def recently_played(limit: int = 30) -> list[dict]:
    """Tracks the user played most recently."""
    res = sp().current_user_recently_played(limit=min(limit, 50))
    return [_track(i["track"]) for i in res["items"]]


@mcp.tool()
def search_tracks(query: str, limit: int = 5) -> list[dict]:
    """Search Spotify tracks. Supports field filters, e.g. 'track:Teardrop artist:Massive Attack'.
    Use this to confirm a track exists and get its URI before adding/playing it."""
    res = sp().search(q=query, type="track", limit=min(limit, 10))
    return [_track(t) for t in res["tracks"]["items"]]


@mcp.tool()
def search_playlists(query: str, limit: int = 10) -> list[dict]:
    """Search existing public playlists (e.g. 'rock nacional argentino'). Play one with play(playlist_id=...).
    Note: Spotify-owned editorial playlists are often not returned to developer apps."""
    res = sp().search(q=query, type="playlist", limit=min(limit, 10))
    out = []
    for p in res["playlists"]["items"]:
        if not p:  # Spotify returns null entries for playlists the app can't see
            continue
        # Feb 2026 API renamed the playlist "tracks" field to "items"
        total = (p.get("items") or p.get("tracks") or {}).get("total")
        out.append(
            {
                "id": p["id"],
                "name": p["name"],
                "owner": p["owner"].get("display_name") or p["owner"]["id"],
                "tracks": total,
                "description": p.get("description", ""),
                "url": p["external_urls"]["spotify"],
            }
        )
    return out


@mcp.tool()
def create_playlist(name: str, description: str = "", public: bool = False) -> dict:
    """Create an empty playlist in the user's library. Returns its id and URL."""
    # POST /me/playlists: Spotify removed /users/{id}/playlists for Development Mode apps (Feb 2026).
    p = sp().current_user_playlist_create(name, public=public, description=description)
    return {"id": p["id"], "url": p["external_urls"]["spotify"]}


@mcp.tool()
def add_to_playlist(playlist_id: str, track_uris: list[str]) -> dict:
    """Add tracks (spotify:track:... URIs) to a playlist."""
    for i in range(0, len(track_uris), 100):  # API max 100 per call
        sp().playlist_add_items(playlist_id, track_uris[i : i + 100])
    return {"added": len(track_uris)}


def _device_id() -> str:
    devices = sp().devices()["devices"]
    if not devices:
        raise RuntimeError("No Spotify device found. Open Spotify on any device and try again.")
    active = next((d for d in devices if d["is_active"]), devices[0])
    return active["id"]


@mcp.tool()
def queue_tracks(track_uris: list[str]) -> dict:
    """Add tracks to the end of the current playback queue (Premium)."""
    dev = _device_id()
    for uri in track_uris:
        sp().add_to_queue(uri, device_id=dev)
    return {"queued": len(track_uris)}


@mcp.tool()
def play(track_uris: list[str] | None = None, playlist_id: str | None = None) -> dict:
    """Start playback now (Premium): either a list of track URIs or a playlist. Replaces what's playing."""
    dev = _device_id()
    if playlist_id:
        sp().start_playback(device_id=dev, context_uri=f"spotify:playlist:{playlist_id}")
    elif track_uris:
        sp().start_playback(device_id=dev, uris=track_uris)
    else:
        sp().start_playback(device_id=dev)  # resume
    return {"playing": True}


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "auth":
        am = _auth_manager(open_browser=True)
        am.get_access_token(as_dict=False)
        os.chmod(HERE / ".spotify_token_cache", 0o600)
        me = spotipy.Spotify(auth_manager=am).current_user()
        print(f"Logged in as {me.get('display_name') or me['id']}. Token cached.")
    else:
        mcp.run()  # stdio
