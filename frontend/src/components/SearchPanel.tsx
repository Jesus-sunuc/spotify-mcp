import { Input } from '@base-ui/react/input'
import { Tabs } from '@base-ui/react/tabs'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api'
import type { Artist, Playlist, SearchType, Track } from '../api'
import { SearchIcon } from './icons'
import { ResultRow } from './ResultRow'

type Results = { type: 'track'; items: Track[] } | { type: 'artist'; items: Artist[] } | { type: 'playlist'; items: Playlist[] }

type Props = {
  onPlay: (body: { uris?: string[]; context_uri?: string }, label: string) => void
  onQueue: (uri: string, label: string) => void
  onError: (message: string) => void
}

const TABS: { value: SearchType; label: string }[] = [
  { value: 'track', label: 'Songs' },
  { value: 'artist', label: 'Artists' },
  { value: 'playlist', label: 'Playlists' },
]

export function SearchPanel({ onPlay, onQueue, onError }: Props) {
  const [query, setQuery] = useState('')
  const [type, setType] = useState<SearchType>('track')
  const [results, setResults] = useState<Results | null>(null)
  const [loading, setLoading] = useState(false)

  async function runSearch(q: string, t: SearchType) {
    if (!q.trim()) return
    setLoading(true)
    try {
      // The cast keeps the discriminated union in sync with the requested type.
      setResults({ type: t, items: await api.search(q.trim(), t) } as Results)
    } catch (e) {
      onError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    runSearch(query, type)
  }

  function onTabChange(value: SearchType) {
    setType(value)
    if (query.trim()) runSearch(query, value)
  }

  return (
    <section aria-labelledby="search-heading">
      <h2 id="search-heading" className="mb-3 text-lg font-semibold">
        Search
      </h2>
      <form onSubmit={onSubmit} className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-neutral-500" />
        <Input
          value={query}
          onValueChange={(v) => setQuery(v)}
          placeholder="Songs, artists or playlists (press Enter)"
          aria-label="Search Spotify"
          className="w-full rounded-full border border-neutral-800 bg-neutral-900 py-2.5 pr-4 pl-10 text-sm placeholder:text-neutral-500 focus:border-green-500 focus:outline-none"
        />
      </form>

      <Tabs.Root value={type} onValueChange={(v) => onTabChange(v as SearchType)} className="mt-4">
        <Tabs.List className="flex gap-1 border-b border-neutral-800">
          {TABS.map((t) => (
            <Tabs.Tab
              key={t.value}
              value={t.value}
              className="-mb-px cursor-pointer border-b-2 border-transparent px-4 py-2 text-sm text-neutral-400 transition hover:text-neutral-200 focus-visible:outline-2 focus-visible:outline-green-400 data-[active]:border-green-500 data-[active]:text-white"
            >
              {t.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        {TABS.map((t) => (
          <Tabs.Panel key={t.value} value={t.value} className="pt-2 focus:outline-none">
            {loading && <p className="p-3 text-sm text-neutral-500">Searching…</p>}
            {!loading && !results && <p className="p-3 text-sm text-neutral-500">Type something and press Enter.</p>}
            {!loading && results?.type === t.value && results.items.length === 0 && (
              <p className="p-3 text-sm text-neutral-500">No results.</p>
            )}
            {!loading && results?.type === t.value && (
              <ul>
                {results.type === 'track' &&
                  results.items.map((tr) => (
                    <ResultRow
                      key={tr.uri}
                      image={tr.image}
                      title={tr.name}
                      subtitle={`${tr.artists} · ${tr.album}`}
                      onPlay={() => onPlay({ uris: [tr.uri] }, tr.name)}
                      onQueue={() => onQueue(tr.uri, tr.name)}
                    />
                  ))}
                {results.type === 'artist' &&
                  results.items.map((a) => (
                    <ResultRow
                      key={a.uri}
                      image={a.image}
                      round
                      title={a.name}
                      subtitle={a.genres.slice(0, 3).join(', ') || 'Artist'}
                      onPlay={() => onPlay({ context_uri: a.uri }, a.name)}
                    />
                  ))}
                {results.type === 'playlist' &&
                  results.items.map((p) => (
                    <ResultRow
                      key={p.uri}
                      image={p.image}
                      title={p.name}
                      subtitle={`by ${p.owner}${p.tracks != null ? ` · ${p.tracks} songs` : ''}`}
                      onPlay={() => onPlay({ context_uri: p.uri }, p.name)}
                    />
                  ))}
              </ul>
            )}
          </Tabs.Panel>
        ))}
      </Tabs.Root>
    </section>
  )
}
