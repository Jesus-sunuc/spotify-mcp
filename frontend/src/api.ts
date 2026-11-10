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

export type Device = {
  name: string
  type: string
  is_active: boolean
  volume_percent: number | null
  selected: boolean
}

export type SleepStatus = { active: boolean; ends_at: string | null; fade_minutes: number }

export type Alarm = {
  id: number
  time: string // 'HH:MM' 24h
  days: number[] // 0=Mon..6=Sun; [] = once
  uri: string
  label: string
  target_volume: number
  ramp_minutes: number
  enabled: boolean
  last_fired: string | null
}

export type NewAlarm = Omit<Alarm, 'id' | 'enabled' | 'last_fired'>

export type LoopStatus = {
  active: boolean
  a_ms: number | null
  b_ms: number | null
  track_uri: string | null
  stopped_reason: string | null
}

export type Release = {
  uri: string
  id: string
  name: string
  artists: string
  type: 'album' | 'single' | 'compilation'
  total_tracks: number | null
  release_date: string // YYYY-MM-DD
  image: string | null
  because: string // which of your top artists it came from
}

export type Releases = { items: Release[]; updated_at: number; days_back: number }

export type PartySongHost = {
  id: number
  uri: string
  name: string
  artists: string
  image: string | null
  added_by: string
  votes: number
}

export type PartyHostState = {
  active: boolean
  url: string | null // what the QR code encodes
  host: string // address guests' phones use to reach this Mac
  port: string
  songs: PartySongHost[]
}

export type SearchResults = { track: Track; artist: Artist; playlist: Playlist }
export type SearchType = keyof SearchResults

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...init })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Backend errors are {"error": "..."}; FastAPI errors are {"detail": "..."} or a list of validation errors
    const detail = Array.isArray(data.detail) ? data.detail[0]?.msg : data.detail
    const message = data.error ?? (typeof detail === 'string' ? detail : null)
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

  devices: () => request<Device[]>('/devices'),
  selectDevice: (name: string) => request('/devices/selected', { method: 'PUT', body: JSON.stringify({ name }) }),

  sleep: () => request<SleepStatus>('/sleep'),
  startSleep: (minutes: number) => post<SleepStatus>('/sleep', { minutes }),
  cancelSleep: () => request<SleepStatus>('/sleep', { method: 'DELETE' }),

  alarms: () => request<Alarm[]>('/alarms'),
  createAlarm: (alarm: NewAlarm) => post<Alarm>('/alarms', alarm),
  setAlarmEnabled: (id: number, enabled: boolean) =>
    request<Alarm>(`/alarms/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
  deleteAlarm: (id: number) => request(`/alarms/${id}`, { method: 'DELETE' }),
  testAlarm: (id: number) => post(`/alarms/${id}/test`),

  loop: () => request<LoopStatus>('/loop'),
  startLoop: (a_ms: number, b_ms: number) => post<LoopStatus>('/loop', { a_ms, b_ms }),
  stopLoop: () => request<LoopStatus>('/loop', { method: 'DELETE' }),

  releases: (refresh = false) => request<Releases>(`/releases${refresh ? '?refresh=true' : ''}`),

  party: () => request<PartyHostState>('/party'),
  startParty: () => post<PartyHostState>('/party'),
  endParty: () => request<PartyHostState>('/party', { method: 'DELETE' }),
  setPartyHost: (host: string) => request<PartyHostState>('/party/host', { method: 'PUT', body: JSON.stringify({ host }) }),
  removePartySong: (id: number) => request(`/party/songs/${id}`, { method: 'DELETE' }),
  /** Changes whenever the link changes, so the <img> reloads. */
  partyQrUrl: (url: string) => `/api/party/qr.svg?v=${encodeURIComponent(url)}`,
}
