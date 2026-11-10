import { Button } from '@base-ui/react/button'
import type { Artist } from '../api'
import { Cover } from './Cover'
import { PlayIcon } from './icons'

type Props = { artists: Artist[] | null; onPlay: (artist: Artist) => void }

export function TopArtists({ artists, onPlay }: Props) {
  return (
    <section aria-labelledby="top-heading">
      <h2 id="top-heading" className="mb-3 text-lg font-semibold">
        Your top artists
      </h2>
      {!artists && <p className="text-sm text-neutral-500">Loading…</p>}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {artists?.map((a) => (
          <li key={a.uri}>
            <Button
              onClick={() => onPlay(a)}
              aria-label={`Play ${a.name}`}
              className="group relative flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl p-3 text-center transition hover:bg-neutral-900 focus-visible:outline-2 focus-visible:outline-green-400"
            >
              <div className="relative">
                <Cover src={a.image} round className="size-24" />
                <span className="absolute right-0 bottom-0 grid size-9 translate-y-1 place-items-center rounded-full bg-green-500 text-neutral-950 opacity-0 shadow-lg transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:opacity-100">
                  <PlayIcon className="size-4" />
                </span>
              </div>
              <span className="w-full truncate text-sm font-medium">{a.name}</span>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
