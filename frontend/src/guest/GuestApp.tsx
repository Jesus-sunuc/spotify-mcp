import { Button } from '@base-ui/react/button'
import { Input } from '@base-ui/react/input'
import { Tabs } from '@base-ui/react/tabs'
import { Toast } from '@base-ui/react/toast'
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Cover } from '../components/Cover'
import { CheckIcon, MusicIcon, PlusIcon, SearchIcon } from '../components/icons'
import { Toasts } from '../components/Toasts'
import { getName, guestApi, hasCode, setName } from './guestApi'
import type { GuestTrack, PartyState } from './guestApi'

const POLL_MS = 5000

export function GuestApp() {
  const [name, setNameState] = useState(getName())
  if (!hasCode) return <Message title="Scan the QR code" body="Ask the host to show you the party QR code, then open it with your camera." />
  if (!name) return <NamePrompt onDone={setNameState} />
  return <Party name={name} />
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <MusicIcon className="mx-auto size-10 text-green-400" />
        <h1 className="mt-4 text-xl font-bold">{title}</h1>
        <p className="mt-2 text-neutral-400">{body}</p>
      </div>
    </main>
  )
}

function NamePrompt({ onDone }: { onDone: (name: string) => void }) {
  const [value, setValue] = useState('')
  function submit(e: FormEvent) {
    e.preventDefault()
    if (!value.trim()) return
    setName(value)
    onDone(value.trim().slice(0, 24))
  }
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm text-center">
        <span className="text-4xl" aria-hidden="true">
          🎉
        </span>
        <h1 className="mt-3 text-2xl font-bold">You're at the party!</h1>
        <p className="mt-2 text-neutral-400">Add songs and vote for what plays next. What should we call you?</p>
        <Input
          autoFocus
          value={value}
          onValueChange={(v) => setValue(v)}
          maxLength={24}
          placeholder="Your name"
          aria-label="Your name"
          className="mt-6 w-full rounded-full border border-neutral-700 bg-neutral-900 px-5 py-3 text-center text-lg focus:border-green-500 focus:outline-none"
        />
        <Button
          type="submit"
          disabled={!value.trim()}
          className="mt-4 w-full cursor-pointer rounded-full bg-green-500 py-3 text-lg font-semibold text-neutral-950 data-[disabled]:opacity-40"
        >
          Join
        </Button>
      </form>
    </main>
  )
}

function Party({ name }: { name: string }) {
  const toast = Toast.useToastManager()
  const [state, setState] = useState<PartyState | null>(null)
  const [ended, setEnded] = useState<string | null>(null)
  const [tab, setTab] = useState<'next' | 'add'>('next')

  const showError = useCallback((e: unknown) => toast.add({ title: (e as Error).message, type: 'error' }), [toast])

  const refresh = useCallback(async () => {
    try {
      setState(await guestApi.state())
      setEnded(null)
    } catch (e) {
      if ((e as { status?: number }).status === 403) setEnded((e as Error).message)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => clearInterval(id)
  }, [refresh])

  if (ended) return <Message title="The party's over 🌙" body={ended} />

  async function vote(id: number, up: boolean) {
    try {
      await guestApi.vote(id, up)
      refresh()
    } catch (e) {
      showError(e)
    }
  }

  async function add(t: GuestTrack) {
    try {
      await guestApi.add(t.uri)
      toast.add({ title: `Added “${t.name}”`, timeout: 2500 })
      setTab('next')
      refresh()
      return true
    } catch (e) {
      showError(e)
      return false
    }
  }

  const np = state?.now_playing
  return (
    <div className="mx-auto min-h-dvh max-w-lg pb-10">
      <header className="sticky top-0 z-10 border-b border-neutral-900 bg-neutral-950/95 px-4 pt-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">🎉 Party Jukebox</h1>
          <span className="text-sm text-neutral-500">Hi, {name}</span>
        </div>
        {np && (
          <div className="mt-3 flex items-center gap-3 rounded-xl bg-neutral-900 p-2">
            <Cover src={np.image} className="size-12" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold tracking-wider text-green-400 uppercase">{np.is_playing ? 'Now playing' : 'Paused'}</p>
              <p className="truncate font-medium">{np.name}</p>
              <p className="truncate text-sm text-neutral-400">{np.artists}</p>
            </div>
          </div>
        )}
        <Tabs.Root value={tab} onValueChange={(v) => setTab(v as 'next' | 'add')}>
          <Tabs.List className="mt-3 grid grid-cols-2">
            {[
              { value: 'next', label: `Up next${state ? ` (${state.songs.length})` : ''}` },
              { value: 'add', label: 'Add a song' },
            ].map((t) => (
              <Tabs.Tab
                key={t.value}
                value={t.value}
                className="cursor-pointer border-b-2 border-transparent py-3 text-sm font-medium text-neutral-400 data-[active]:border-green-500 data-[active]:text-white"
              >
                {t.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.Root>
      </header>

      <main className="px-4 pt-3">
        {tab === 'next' ? <UpNext state={state} onVote={vote} onAdd={() => setTab('add')} /> : <AddSong onAdd={add} onError={showError} />}
      </main>
      <Toasts />
    </div>
  )
}

function UpNext({ state, onVote, onAdd }: { state: PartyState | null; onVote: (id: number, up: boolean) => void; onAdd: () => void }) {
  if (!state) return <p className="p-4 text-center text-neutral-500">Loading…</p>
  if (state.songs.length === 0)
    return (
      <div className="p-8 text-center">
        <p className="text-neutral-400">Nothing on the list yet.</p>
        <Button onClick={onAdd} className="mt-4 cursor-pointer rounded-full bg-green-500 px-5 py-2.5 font-semibold text-neutral-950">
          Add the first song
        </Button>
      </div>
    )
  return (
    <>
      <p className="mb-2 text-xs text-neutral-500">The song with the most votes plays next. Tap ♥ to vote.</p>
      <ol className="space-y-1">
        {state.songs.map((s, i) => (
          <li key={s.id} className="flex items-center gap-3 rounded-xl p-2 even:bg-neutral-900/40">
            <span className="w-5 text-center text-sm text-neutral-500 tabular-nums">{i + 1}</span>
            <Cover src={s.image} className="size-11" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{s.name}</p>
              <p className="truncate text-xs text-neutral-400">
                {s.artists} · <span className="text-neutral-500">{s.mine ? 'added by you' : `by ${s.added_by}`}</span>
              </p>
            </div>
            <Button
              onClick={() => onVote(s.id, !s.my_vote)}
              aria-pressed={s.my_vote}
              aria-label={`${s.my_vote ? 'Remove vote for' : 'Vote for'} ${s.name}, ${s.votes} votes`}
              className={`flex min-w-14 cursor-pointer items-center justify-center gap-1 rounded-full px-3 py-2 text-sm font-semibold tabular-nums transition ${
                s.my_vote ? 'bg-green-500 text-neutral-950' : 'bg-neutral-800 text-neutral-200'
              }`}
            >
              <span aria-hidden="true">{s.my_vote ? '♥' : '♡'}</span> {s.votes}
            </Button>
          </li>
        ))}
      </ol>
    </>
  )
}

function AddSong({ onAdd, onError }: { onAdd: (t: GuestTrack) => Promise<boolean>; onError: (e: unknown) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GuestTrack[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [added, setAdded] = useState<Set<string>>(new Set())

  async function search(e: FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    try {
      setResults(await guestApi.search(query))
    } catch (err) {
      onError(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <form onSubmit={search} className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-neutral-500" />
        <Input
          type="search"
          enterKeyHint="search"
          value={query}
          onValueChange={(v) => setQuery(v)}
          placeholder="Song or artist"
          aria-label="Search for a song"
          className="w-full rounded-full border border-neutral-800 bg-neutral-900 py-3 pr-4 pl-12 focus:border-green-500 focus:outline-none"
        />
      </form>
      {loading && <p className="p-4 text-center text-neutral-500">Searching…</p>}
      {!loading && results?.length === 0 && <p className="p-4 text-center text-neutral-500">No songs found.</p>}
      <ul className="mt-3 space-y-1">
        {!loading &&
          results?.map((t) => (
            <li key={t.uri} className="flex items-center gap-3 rounded-xl p-2">
              <Cover src={t.image} className="size-11" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.name}</p>
                <p className="truncate text-xs text-neutral-400">{t.artists}</p>
              </div>
              <Button
                disabled={added.has(t.uri)}
                onClick={async () => {
                  if (await onAdd(t)) setAdded((prev) => new Set(prev).add(t.uri)) // only mark it on success
                }}
                aria-label={`Add ${t.name}`}
                className="grid size-10 cursor-pointer place-items-center rounded-full bg-green-500 text-neutral-950 data-[disabled]:bg-neutral-800 data-[disabled]:text-green-400"
              >
                {added.has(t.uri) ? <CheckIcon /> : <PlusIcon className="size-5" />}
              </Button>
            </li>
          ))}
      </ul>
    </>
  )
}
