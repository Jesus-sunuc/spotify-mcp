import { Toast } from '@base-ui/react/toast'
import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import type { Alarm, Artist, Device, LoopStatus, NewAlarm, NowPlaying, PartyHostState, Releases, SleepStatus } from './api'
import { Alarms } from './components/Alarms'
import { NewReleases } from './components/NewReleases'
import { NowPlayingBar } from './components/NowPlayingBar'
import { Party } from './components/Party'
import { SearchPanel } from './components/SearchPanel'
import { Toasts } from './components/Toasts'
import { TopArtists } from './components/TopArtists'
import { formatTime } from './lib/alarmFormat'

const POLL_MS = 5000

export default function App() {
  const toast = Toast.useToastManager()
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null)
  const [sleep, setSleep] = useState<SleepStatus | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  const [topArtists, setTopArtists] = useState<Artist[] | null>(null)
  const [alarms, setAlarms] = useState<Alarm[] | null>(null)
  const [loop, setLoop] = useState<LoopStatus | null>(null)
  const [releases, setReleases] = useState<Releases | null>(null)
  const [releasesLoading, setReleasesLoading] = useState(true) // first load starts on mount
  const [party, setParty] = useState<PartyHostState | null>(null)
  const [backendError, setBackendError] = useState<string | null>(null)

  const showError = useCallback(
    (message: string) => toast.add({ title: 'Something went wrong', description: message, type: 'error' }),
    [toast],
  )

  const refresh = useCallback(async () => {
    try {
      // sleep, loop and party are local to the backend (no Spotify quota); only now-playing hits Spotify
      const [np, sl, lp, pt] = await Promise.all([api.nowPlaying(), api.sleep(), api.loop(), api.party()])
      setNowPlaying(np)
      setSleep(sl)
      setLoop(lp)
      setParty(pt)
      setBackendError(null)
    } catch (e) {
      setBackendError((e as Error).message)
    }
  }, [])

  const refreshDevices = useCallback(() => {
    api.devices().then(setDevices).catch((e: Error) => showError(e.message))
  }, [showError])

  const refreshAlarms = useCallback(() => {
    api.alarms().then(setAlarms).catch((e: Error) => showError(e.message))
  }, [showError])

  const loadReleases = useCallback(
    (refresh = false) => {
      if (refresh) setReleasesLoading(true)
      api
        .releases(refresh)
        .then(setReleases)
        .catch((e: Error) => showError(e.message))
        .finally(() => setReleasesLoading(false))
    },
    [showError],
  )

  /** Ask the backend for the live position (the last poll can be up to 5s old). */
  const getPosition = useCallback(async () => {
    try {
      const np = await api.nowPlaying()
      setNowPlaying(np)
      return np.progress_ms ?? null
    } catch (e) {
      showError((e as Error).message)
      return null
    }
  }, [showError])

  // Poll playback + sleep timer so changes made elsewhere (Spotify app, the timer itself) show up here.
  useEffect(() => {
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  useEffect(() => {
    api.topArtists().then(setTopArtists).catch((e: Error) => showError(e.message))
    refreshDevices()
    refreshAlarms()
    loadReleases()
  }, [showError, refreshDevices, refreshAlarms, loadReleases])

  /** Run an action, toast the result, then refresh the now-playing bar. Returns whether it succeeded. */
  async function act(action: () => Promise<unknown>, success: string) {
    try {
      await action()
      toast.add({ title: success, timeout: 2500 })
      setTimeout(refresh, 800) // give Spotify a moment to switch tracks
      return true
    } catch (e) {
      showError((e as Error).message)
      return false
    }
  }

  const selectedDevice = devices.find((d) => d.selected)?.name

  return (
    <div className="min-h-screen pb-36 sm:pb-28">
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

        <NewReleases
          data={releases}
          loading={releasesLoading}
          onRefresh={() => loadReleases(true)}
          onPlay={(r) => act(() => api.play({ context_uri: r.uri }), `Playing ${r.name}`)}
        />

        <SearchPanel
          onPlay={(body, label) => act(() => api.play(body), `Playing ${label}`)}
          onQueue={(uri, label) => act(() => api.queue([uri]), `Queued ${label}`)}
          onError={showError}
        />

        <Party
          state={party}
          onStart={() => act(async () => setParty(await api.startParty()), 'Party started 🎉')}
          onEnd={() => act(async () => setParty(await api.endParty()), 'Party ended')}
          onSetHost={(host) => act(async () => setParty(await api.setPartyHost(host)), `Guests will use ${host}`)}
          onRemove={(id, name) => act(async () => (await api.removePartySong(id), setParty(await api.party())), `Removed ${name}`)}
          onCopied={() => toast.add({ title: 'Guest link copied', timeout: 2000 })}
        />

        <Alarms
          alarms={alarms}
          onError={showError}
          onCreate={async (a: NewAlarm) => {
            const ok = await act(() => api.createAlarm(a), `Alarm set for ${formatTime(a.time)}`)
            if (ok) refreshAlarms()
            return ok
          }}
          onToggle={async (a, enabled) => {
            if (await act(() => api.setAlarmEnabled(a.id, enabled), `${formatTime(a.time)} alarm ${enabled ? 'on' : 'off'}`))
              refreshAlarms()
          }}
          onDelete={async (a) => {
            if (await act(() => api.deleteAlarm(a.id), `Deleted ${formatTime(a.time)} alarm`)) refreshAlarms()
          }}
          onTest={(a) => act(() => api.testAlarm(a.id), `Testing: ${a.label} on ${selectedDevice ?? 'your device'}`)}
        />
      </main>

      <NowPlayingBar
        state={nowPlaying}
        onToggle={() => (nowPlaying?.is_playing ? act(api.pause, 'Paused') : act(() => api.play(), 'Resumed'))}
        devices={devices}
        onRefreshDevices={refreshDevices}
        onSelectDevice={async (name) => {
          if (await act(() => api.selectDevice(name), `Playing on ${name}`)) refreshDevices()
        }}
        sleep={sleep}
        onStartSleep={(m) => act(() => api.startSleep(m), `Sleep timer: ${m} minutes`)}
        onCancelSleep={() => act(api.cancelSleep, 'Sleep timer off')}
        loop={loop}
        getPosition={getPosition}
        onStartLoop={async (a, b) => {
          try {
            setLoop(await api.startLoop(a, b))
            toast.add({ title: 'Looping A-B', timeout: 2000 })
          } catch (e) {
            showError((e as Error).message)
          }
        }}
        onStopLoop={async () => {
          try {
            setLoop(await api.stopLoop())
            toast.add({ title: 'Loop stopped', timeout: 2000 })
          } catch (e) {
            showError((e as Error).message)
          }
        }}
      />
      <Toasts />
    </div>
  )
}
