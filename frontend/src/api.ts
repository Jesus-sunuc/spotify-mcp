// Typed client for the FastAPI backend (backend/api.py). Vite proxies /api to it.

export type Track = {
  uri: string
  name: string
  artists: string
  album: string
  image: string | null
  duration_ms: number | null
}

export type Artist = { uri: string; name: string; genres: string[]; image: string | null }

export type Playlist = { uri: string; name: string; owner: string; tracks: number | null; image: string | null }

export type NowPlaying = {
  is_playing: boolean
  progress_ms?: number | null
  track: Track | null
  device: string | null
}

export type SearchResults = { track: Track; artist: Artist; playlist: Playlist }
export type SearchType = keyof SearchResults

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...init })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Backend errors are {"error": "..."}; FastAPI validation errors are {"detail": ...}
    const message = data.error ?? (typeof data.detail === 'string' ? data.detail : null)
    throw new Error(message ?? `Request failed (${res.status})`)
  }
  return data as T
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })

export const api = {
  nowPlaying: () => request<NowPlaying>('/now-playing'),
  topArtists: () => request<Artist[]>('/top-artists'),
  search: <K extends SearchType>(q: string, type: K) =>
    request<SearchResults[K][]>(`/search?q=${encodeURIComponent(q)}&type=${type}`),
  /** Tracks (uris), an artist/playlist (context_uri), or resume with no arguments. */
  play: (body: { uris?: string[]; context_uri?: string } = {}) => post('/play', body),
  pause: () => post('/pause'),
  queue: (uris: string[]) => post('/queue', { uris }),
}
