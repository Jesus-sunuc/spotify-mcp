import { Button } from '@base-ui/react/button'
import type { Release, Releases } from '../api'
import { formatDate } from '../lib/alarmFormat'
import { Cover } from './Cover'
import { PlayIcon, RefreshIcon } from './icons'

type Props = {
  data: Releases | null
  loading: boolean
  onPlay: (release: Release) => void
  onRefresh: () => void
}

export function NewReleases({ data, loading, onPlay, onRefresh }: Props) {
  return (
    <section aria-labelledby="releases-heading">
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <div>
          <h2 id="releases-heading" className="text-lg font-semibold">
            New from your artists
          </h2>
          <p className="text-xs text-neutral-500">
            Last {data?.days_back ?? 90} days, only from artists you actually play.
          </p>
        </div>
        <Button
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh new releases"
          title={data ? `Updated ${new Date(data.updated_at * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : undefined}
          className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-400 hover:text-white data-[disabled]:cursor-wait data-[disabled]:opacity-50"
        >
          <RefreshIcon className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {!data && <p className="text-sm text-neutral-500">{loading ? 'Checking your artists for new music…' : 'Couldn’t load releases.'}</p>}
      {data?.items.length === 0 && <p className="text-sm text-neutral-500">Nothing new from your top artists lately.</p>}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {data?.items.map((r) => (
          <li key={r.id}>
            <Button
              onClick={() => onPlay(r)}
              aria-label={`Play ${r.name} by ${r.artists}`}
              className="group w-full cursor-pointer rounded-xl p-2 text-left transition hover:bg-neutral-900 focus-visible:outline-2 focus-visible:outline-green-400"
            >
              <div className="relative">
                <Cover src={r.image} className="aspect-square h-auto w-full" />
                <span className="absolute right-2 bottom-2 grid size-10 translate-y-1 place-items-center rounded-full bg-green-500 text-neutral-950 opacity-0 shadow-lg transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100">
                  <PlayIcon className="size-4" />
                </span>
              </div>
              <p className="mt-2 truncate text-sm font-medium">{r.name}</p>
              <p className="truncate text-xs text-neutral-400">{r.artists}</p>
              <p className="mt-0.5 text-xs text-neutral-500 capitalize">
                {r.type} · {formatDate(r.release_date)}
              </p>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
