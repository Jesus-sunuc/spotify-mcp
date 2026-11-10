"""Party jukebox: guests suggest songs and vote; the top song is queued before the current one ends.

Shared by api.py (host, localhost only) and guest_api.py (guests, open to the local network).
"""

import os
import secrets

import db

MAX_PENDING_PER_GUEST = 3
GUEST_PORT = os.environ.get("PARTY_PORT", "5176")


class PartyError(Exception):
    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


# ---------- party on/off ----------

def active_code() -> str | None:
    return db.get_setting("party_code")


def start() -> str:
    code = secrets.token_urlsafe(6)  # ~48 bits: not guessable by someone else on the Wi-Fi
    db.set_setting("party_code", code)
    return code


def end() -> None:
    db.delete_setting("party_code")


def check_code(code: str | None) -> str:
    """Raise unless `code` is the active party's code. Returns the code."""
    active = active_code()
    if not active:
        raise PartyError("There's no party right now.", 403)
    if not code or not secrets.compare_digest(code, active):
        raise PartyError("This party link is out of date. Scan the QR code again.", 403)
    return active


# ---------- guest link ----------

def host_address() -> str:
    """Address guests' phones use to reach this Mac, e.g. 'jesust.local' or '192.168.1.20'."""
    return db.get_setting("party_host") or os.environ.get("PARTY_HOST", "")


def set_host_address(host: str) -> None:
    db.set_setting("party_host", host.strip())


def guest_url() -> str | None:
    code, host = active_code(), host_address()
    return f"http://{host}:{GUEST_PORT}/?code={code}" if code and host else None


# ---------- songs + votes ----------

def songs(code: str, guest_id: str | None = None) -> list[dict]:
    """Pending songs, most votes first (ties: whoever added first)."""
    with db.connect() as con:
        rows = con.execute(
            """
            SELECT s.id, s.uri, s.name, s.artists, s.image, s.duration_ms, s.added_by, s.added_at,
                   COUNT(v.guest_id) AS votes,
                   COALESCE(MAX(v.guest_id = :guest), 0) AS my_vote,
                   s.guest_id = :guest AS mine
            FROM party_songs s
            LEFT JOIN party_votes v ON v.song_id = s.id
            WHERE s.party_code = :code AND s.status = 'pending'
            GROUP BY s.id
            ORDER BY votes DESC, s.added_at ASC, s.id ASC
            """,
            {"code": code, "guest": guest_id or ""},
        ).fetchall()
    return [{**dict(r), "my_vote": bool(r["my_vote"]), "mine": bool(r["mine"])} for r in rows]


def add_song(code: str, track: dict, guest_id: str, guest_name: str) -> dict:
    with db.connect() as con:
        if con.execute(
            "SELECT 1 FROM party_songs WHERE party_code = ? AND uri = ? AND status = 'pending'", (code, track["uri"])
        ).fetchone():
            raise PartyError("That song is already on the list. Vote for it instead!", 409)
        mine = con.execute(
            "SELECT COUNT(*) FROM party_songs WHERE party_code = ? AND guest_id = ? AND status = 'pending'",
            (code, guest_id),
        ).fetchone()[0]
        if mine >= MAX_PENDING_PER_GUEST:
            raise PartyError(f"You already have {MAX_PENDING_PER_GUEST} songs waiting. Let some play first.", 429)
        cur = con.execute(
            """INSERT INTO party_songs (party_code, uri, name, artists, image, duration_ms, added_by, guest_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (code, track["uri"], track["name"], track["artists"], track.get("image"), track.get("duration_ms"), guest_name, guest_id),
        )
        con.execute("INSERT INTO party_votes (song_id, guest_id) VALUES (?, ?)", (cur.lastrowid, guest_id))  # you vote for your own song
    return {"id": cur.lastrowid}


def vote(code: str, song_id: int, guest_id: str, up: bool) -> None:
    with db.connect() as con:
        if not con.execute(
            "SELECT 1 FROM party_songs WHERE id = ? AND party_code = ? AND status = 'pending'", (song_id, code)
        ).fetchone():
            raise PartyError("That song already played or was removed.", 404)
        if up:
            con.execute("INSERT OR IGNORE INTO party_votes (song_id, guest_id) VALUES (?, ?)", (song_id, guest_id))
        else:
            con.execute("DELETE FROM party_votes WHERE song_id = ? AND guest_id = ?", (song_id, guest_id))


def set_status(song_id: int, status: str) -> bool:
    with db.connect() as con:
        return con.execute("UPDATE party_songs SET status = ? WHERE id = ?", (status, song_id)).rowcount > 0


def pop_top(code: str) -> dict | None:
    """Take the most-voted pending song off the list (marks it queued)."""
    top = next(iter(songs(code)), None)
    if top:
        set_status(top["id"], "queued")
    return top
