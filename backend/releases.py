"""New albums/singles from the user's top artists (no algorithmic picks), cached to spare the API quota."""

import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

import server

CACHE_SECONDS = 6 * 60 * 60
DAYS_BACK = 90
TOP_ARTISTS = 20

_cache: dict = {"at": 0.0, "items": None}
_lock = threading.Lock()  # one refresh at a time even if several requests arrive together


def _release_date(album: dict) -> date | None:
    """Spotify dates can be 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD' (see release_date_precision)."""
    raw = album.get("release_date") or ""
    parts = [int(p) for p in raw.split("-") if p.isdigit()]
    if not parts:
        return None
    if album.get("release_date_precision") == "year" or len(parts) == 1:
        return None  # too vague to call it "new"
    return date(parts[0], parts[1], parts[2] if len(parts) > 2 else 1)


def _top_artists() -> list[dict]:
    """Medium-term favourites first, then recent ones not already included."""
    seen, out = set(), []
    for time_range, limit in (("medium_term", TOP_ARTISTS), ("short_term", 10)):
        for a in server.sp().current_user_top_artists(limit=limit, time_range=time_range)["items"]:
            if a["id"] not in seen:
                seen.add(a["id"])
                out.append(a)
    return out[: TOP_ARTISTS + 5]


def _artist_releases(artist: dict, since: date) -> list[dict]:
    # Spotify lists every album before any single, so ask for each group separately;
    # otherwise prolific artists' recent singles fall off the first page.
    items = []
    for group in ("album", "single"):
        items += server.sp().artist_albums(artist["id"], include_groups=group, limit=5).get("items", [])
    out = []
    for al in items:
        released = _release_date(al)
        if not released or released < since:
            continue
        out.append(
            {
                "uri": al["uri"],
                "id": al["id"],
                "name": al["name"],
                "artists": ", ".join(a["name"] for a in al["artists"]),
                "type": al.get("album_type", "album"),
                "total_tracks": al.get("total_tracks"),
                "release_date": released.isoformat(),
                "image": al["images"][0]["url"] if al.get("images") else None,
                "because": artist["name"],
            }
        )
    return out


def _fetch() -> list[dict]:
    since = date.today() - timedelta(days=DAYS_BACK)
    artists = _top_artists()
    with ThreadPoolExecutor(max_workers=4) as pool:  # a few in parallel; still gentle on the quota
        batches = list(pool.map(lambda a: _artist_releases(a, since), artists))
    by_id: dict[str, dict] = {}
    for batch in batches:
        for item in batch:
            by_id.setdefault(item["id"], item)  # collabs show up under several artists
    return sorted(by_id.values(), key=lambda x: x["release_date"], reverse=True)


def get(refresh: bool = False) -> dict:
    with _lock:
        fresh = _cache["items"] is not None and time.time() - _cache["at"] < CACHE_SECONDS
        if refresh or not fresh:
            _cache["items"] = _fetch()
            _cache["at"] = time.time()
    return {
        "items": _cache["items"],
        "updated_at": int(_cache["at"]),
        "days_back": DAYS_BACK,
    }
