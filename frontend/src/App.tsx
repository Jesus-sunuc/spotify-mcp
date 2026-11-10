import { Toast } from '@base-ui/react/toast'
import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import type { Artist, NowPlaying } from './api'
import { NowPlayingBar } from './components/NowPlayingBar'
import { SearchPanel } from './components/SearchPanel'
import { Toasts } from './components/Toasts'
import { TopArtists } from './components/TopArtists'

const POLL_MS = 5000

export default function App() {
  const toast = Toast.useToastManager()
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null)
  const [topArtists, setTopArtists] = useState<Artist[] | null>(null)
  const [backendError, setBackendError] = useState<string | null>(null)

  const showError = useCallback(
    (message: string) => toast.add({ title: 'Spotify error', description: message, type: 'error' }),
    [toast],
  )

  const refresh = useCallback(async () => {
    try {
      setNowPlaying(await api.nowPlaying())
      setBackendError(null)
    } catch (e) {
      setBackendError((e as Error).message)
    }
  }, [])

  // Poll playback state so changes made in the Spotify app show up here too.
  useEffect(() => {
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  useEffect(() => {
    api.topArtists().then(setTopArtists).catch((e: Error) => showError(e.message))
  }, [showError])

  /** Run a playback action, toast the result, then refresh the now-playing bar. */
  async function act(action: () => Promise<unknown>, success: string) {
    try {
      await action()
      toast.add({ title: success, timeout: 2500 })
      setTimeout(refresh, 800) // give Spotify a moment to switch tracks
    } catch (e) {
      showError((e as Error).message)
    }
  }

  return (
    <div className="min-h-screen pb-28">
      <header className="border-b border-neutral-900">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <span className="size-3 rounded-full bg-green-500" aria-hidden="true" />
          <h1 className="text-xl font-bold tracking-tight">Music Remote</h1>
          <span className="text-sm text-neutral-500">spotify-mcp</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-8">
        {backendError && (
          <p role="alert" className="rounded-lg border border-red-900 bg-red-950 p-3 text-sm text-red-100">
            Can't reach Spotify through the backend: {backendError}
          </p>
        )}

        <TopArtists artists={topArtists} onPlay={(a) => act(() => api.play({ context_uri: a.uri }), `Playing ${a.name}`)} />

        <SearchPanel
          onPlay={(body, label) => act(() => api.play(body), `Playing ${label}`)}
          onQueue={(uri, label) => act(() => api.queue([uri]), `Queued ${label}`)}
          onError={showError}
        />
      </main>

      <NowPlayingBar
        state={nowPlaying}
        onToggle={() => (nowPlaying?.is_playing ? act(api.pause, 'Paused') : act(() => api.play(), 'Resumed'))}
      />
      <Toasts />
    </div>
  )
}
