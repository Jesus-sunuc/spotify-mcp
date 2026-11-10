"""Small SQLite store for the web remote (settings + alarms). File: backend/data/remote.db (git-ignored)."""

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "data" / "remote.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alarms (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  time           TEXT    NOT NULL,            -- 'HH:MM', local time (container TZ)
  days           TEXT    NOT NULL,            -- JSON list of weekdays, 0=Mon..6=Sun; [] = one-off
  uri            TEXT    NOT NULL,            -- spotify:track|album|artist|playlist:...
  label          TEXT    NOT NULL,
  target_volume  INTEGER NOT NULL DEFAULT 40,
  ramp_minutes   INTEGER NOT NULL DEFAULT 10,
  enabled        INTEGER NOT NULL DEFAULT 1,
  last_fired     TEXT                         -- 'YYYY-MM-DD'; stops it firing twice in one day
);

-- Party jukebox: songs guests suggest, and their votes
CREATE TABLE IF NOT EXISTS party_songs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  party_code   TEXT    NOT NULL,
  uri          TEXT    NOT NULL,
  name         TEXT    NOT NULL,
  artists      TEXT    NOT NULL,
  image        TEXT,
  duration_ms  INTEGER,
  added_by     TEXT    NOT NULL,              -- guest's nickname
  guest_id     TEXT    NOT NULL,              -- random id the guest's browser keeps
  added_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  status       TEXT    NOT NULL DEFAULT 'pending'  -- pending | queued | removed
);
CREATE INDEX IF NOT EXISTS party_songs_pending ON party_songs (party_code, status);

CREATE TABLE IF NOT EXISTS party_votes (
  song_id   INTEGER NOT NULL REFERENCES party_songs(id) ON DELETE CASCADE,
  guest_id  TEXT    NOT NULL,
  PRIMARY KEY (song_id, guest_id)
);
"""


@contextmanager
def connect():
    DB_PATH.parent.mkdir(exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    try:
        with con:  # commits on success, rolls back on error
            yield con
    finally:
        con.close()


def init() -> None:
    with connect() as con:
        con.execute("PRAGMA journal_mode=WAL")  # lets the API and background jobs read while one writes
        con.executescript(SCHEMA)


# ---------- settings ----------

def get_setting(key: str, default: str | None = None) -> str | None:
    with connect() as con:
        row = con.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def set_setting(key: str, value: str) -> None:
    with connect() as con:
        con.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )


def delete_setting(key: str) -> None:
    with connect() as con:
        con.execute("DELETE FROM settings WHERE key = ?", (key,))


# ---------- alarms ----------

def _alarm(row: sqlite3.Row) -> dict:
    a = dict(row)
    a["days"] = json.loads(a["days"])
    a["enabled"] = bool(a["enabled"])
    return a


def list_alarms() -> list[dict]:
    with connect() as con:
        return [_alarm(r) for r in con.execute("SELECT * FROM alarms ORDER BY time")]


def get_alarm(alarm_id: int) -> dict | None:
    with connect() as con:
        row = con.execute("SELECT * FROM alarms WHERE id = ?", (alarm_id,)).fetchone()
    return _alarm(row) if row else None


def create_alarm(time: str, days: list[int], uri: str, label: str, target_volume: int, ramp_minutes: int) -> dict:
    with connect() as con:
        cur = con.execute(
            "INSERT INTO alarms (time, days, uri, label, target_volume, ramp_minutes) VALUES (?, ?, ?, ?, ?, ?)",
            (time, json.dumps(sorted(set(days))), uri, label, target_volume, ramp_minutes),
        )
        alarm_id = cur.lastrowid
    return get_alarm(alarm_id)  # type: ignore[return-value]


def update_alarm(alarm_id: int, **fields) -> dict | None:
    allowed = {"enabled", "last_fired"}
    sets = {k: v for k, v in fields.items() if k in allowed}
    if sets:
        with connect() as con:
            con.execute(
                f"UPDATE alarms SET {', '.join(f'{k} = ?' for k in sets)} WHERE id = ?",
                (*sets.values(), alarm_id),
            )
    return get_alarm(alarm_id)


def delete_alarm(alarm_id: int) -> bool:
    with connect() as con:
        return con.execute("DELETE FROM alarms WHERE id = ?", (alarm_id,)).rowcount > 0
