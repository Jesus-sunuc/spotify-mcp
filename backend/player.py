"""Device-aware playback helpers for the web remote. Uses the same Spotify login as server.py."""

import asyncio
import os

import db
import server

# Preferred device unless one is picked in the UI (stored in the settings table).
DEFAULT_DEVICE = os.environ.get("DEFAULT_DEVICE", "Jesús's Echo Dot")


def devices() -> list[dict]:
    return server.sp().devices()["devices"]


def selected_device_name() -> str:
    return db.get_setting("device_name") or DEFAULT_DEVICE


def resolve_device(name: str | None = None) -> dict:
    """The named (or selected) device; falls back to the active device, then any device."""
    devs = devices()
    if not devs:
        raise RuntimeError("No Spotify device found. Open Spotify or wake up the Echo Dot and try again.")
    name = name or selected_device_name()
    return (
        next((d for d in devs if d["name"] == name), None)
        or next((d for d in devs if d["is_active"]), None)
        or devs[0]
    )


def play(uris: list[str] | None = None, context_uri: str | None = None, device: dict | None = None) -> dict:
    """Play tracks or a context (artist/album/playlist) on the selected device. Nothing given = resume there."""
    dev = device or resolve_device()
    if context_uri and context_uri.startswith("spotify:track:"):
        uris, context_uri = [context_uri], None  # a single track isn't a valid context
    kwargs = {"context_uri": context_uri} if context_uri else {"uris": uris} if uris else {}
    server.sp().start_playback(device_id=dev["id"], **kwargs)
    return {"playing": True, "device": dev["name"]}


def queue(uris: list[str]) -> dict:
    dev = resolve_device()
    for uri in uris:
        server.sp().add_to_queue(uri, device_id=dev["id"])
    return {"queued": len(uris), "device": dev["name"]}


def select_device(name: str) -> dict:
    """Remember the device and move current playback to it (keeps playing if it was playing)."""
    dev = next((d for d in devices() if d["name"] == name), None)
    if not dev:
        raise RuntimeError(f"Device '{name}' isn't available right now.")
    db.set_setting("device_name", name)
    cur = server.sp().current_playback()
    if cur and cur.get("device", {}).get("id") != dev["id"]:
        server.sp().transfer_playback(dev["id"], force_play=bool(cur.get("is_playing")))
    return {"selected": name}


def set_volume(percent: int, device_id: str) -> None:
    server.sp().volume(max(0, min(100, round(percent))), device_id=device_id)


async def ramp_volume(device_id: str, start: int, end: int, seconds: float) -> None:
    """Move volume from start to end over `seconds`. At most one API call every 5s to spare the quota."""
    steps = max(1, min(abs(end - start), int(seconds // 5)))
    for i in range(1, steps + 1):
        await asyncio.sleep(seconds / steps)
        await asyncio.to_thread(set_volume, start + (end - start) * i / steps, device_id)
