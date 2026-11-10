// Client for backend/guest_api.py. Every call carries the party code (from the QR link) and a
// random guest id kept in this browser, so votes count once per phone.

export type GuestTrack = { uri: string; name: string; artists: string; image: string | null; duration_ms: number | null }

export type PartySong = {
  id: number
  uri: string
  name: string
  artists: string
  image: string | null
  added_by: string
  votes: number
  my_vote: boolean
  mine: boolean
}

export type PartyState = {
  now_playing: { name: string; artists: string; image: string | null; is_playing: boolean } | null
  songs: PartySong[]
  you: string
}

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null // private mode / blocked storage: fall back to a per-tab id
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* ignore */
    }
  },
}

const code = new URLSearchParams(location.search).get('code') ?? ''

let guestId = store.get('party-guest-id')
if (!guestId) {
  guestId = crypto.randomUUID()
  store.set('party-guest-id', guestId)
}

export const hasCode = code.length > 0
export const getName = () => store.get('party-name') ?? ''
export const setName = (name: string) => store.set('party-name', name.trim().slice(0, 24))

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/guest-api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Party-Code': code,
      'X-Guest-Id': guestId!,
      'X-Guest-Name': encodeURIComponent(getName() || 'Guest'), // headers must be ASCII
    },
  })
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = Array.isArray(data.detail) ? data.detail[0]?.msg : data.detail
    const err = new Error(data.error ?? detail ?? `Something went wrong (${res.status})`) as Error & { status: number }
    err.status = res.status
    throw err
  }
  return data as T
}

export const guestApi = {
  state: () => request<PartyState>('/state'),
  search: (q: string) => request<GuestTrack[]>(`/search?q=${encodeURIComponent(q)}`),
  add: (uri: string) => request<{ id: number }>('/songs', { method: 'POST', body: JSON.stringify({ uri }) }),
  vote: (id: number, up: boolean) => request(`/songs/${id}/vote`, { method: up ? 'PUT' : 'DELETE' }),
}
