# spotify-mcp

Control your Spotify from Claude Code (MCP server + `spotify-dj` agent) or from a small web remote.

```
backend/    Python: MCP server (server.py) + HTTP API for the web app (api.py)
frontend/   React + Vite + Tailwind + Base UI web remote
```

Requires Spotify Premium (playback control) and a Spotify developer app.

## Setup

1. Create an app at <https://developer.spotify.com/dashboard>, enable **Web API**, and set the redirect URI to `http://127.0.0.1:8888/callback`.
2. Backend:
   ```sh
   cd backend
   cp .env.example .env            # fill in SPOTIPY_CLIENT_ID / SPOTIPY_CLIENT_SECRET
   python3 -m venv .venv && .venv/bin/python -m pip install -r requirements.txt
   .venv/bin/python server.py auth # one-time browser login; token cached in .spotify_token_cache
   ```
3. Frontend:
   ```sh
   cd frontend && npm install
   ```

## Run the web remote

Two terminals:

```sh
cd backend  && .venv/bin/uvicorn api:app --host 127.0.0.1 --port 8000 --reload
cd frontend && npm run dev      # http://localhost:5173 (proxies /api to :8000)
```

Features: now-playing bar with play/pause, your top artists (one click to play), search songs / artists / playlists with play and add-to-queue.

## Use from Claude Code

```sh
claude mcp add spotify --scope user -- "$PWD/backend/.venv/bin/python" "$PWD/backend/server.py"
```

MCP tools: `top_tracks`, `top_artists`, `recently_played`, `search_tracks`, `search_playlists`, `create_playlist`, `add_to_playlist`, `queue_tracks`, `play`, `play_artist`, `pause`.

## Notes

- Spotify's Feb 2026 API changes apply to Development Mode apps: search returns at most 10 results, playlists are created via `/me/playlists`, and Spotify-owned editorial playlists are mostly hidden.
- Never commit `.env` or `.spotify_token_cache` (both are git-ignored).
