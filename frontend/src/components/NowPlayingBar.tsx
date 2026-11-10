import { Button } from '@base-ui/react/button'
import type { NowPlaying } from '../api'
import { Cover } from './Cover'
import { PauseIcon, PlayIcon } from './icons'

type Props = { state: NowPlaying | null; onToggle: () => void }

export function NowPlayingBar({ state, onToggle }: Props) {
  const track = state?.track
  const progress =
    track?.duration_ms && state?.progress_ms != null ? Math.min(100, (state.progress_ms / track.duration_ms) * 100) : 0

  return (
    <footer className="fixed inset-x-0 bottom-0 border-t border-neutral-800 bg-neutral-900/95 backdrop-blur">
      {/* Progress only refreshes on each poll (every few seconds) */}
      <div className="h-0.5 bg-neutral-800">
        <div className="h-full bg-green-500 transition-[width] duration-1000" style={{ width: `${progress}%` }} />
      </div>
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Cover src={track?.image ?? null} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{track ? track.name : 'Nothing playing'}</p>
          <p className="truncate text-sm text-neutral-400">
            {track ? track.artists : 'Pick something below to start'}
            {state?.device && <span className="text-neutral-500"> · on {state.device}</span>}
          </p>
        </div>
        <Button
          onClick={onToggle}
          aria-label={state?.is_playing ? 'Pause' : 'Play'}
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-green-500 text-neutral-950 transition hover:scale-105 hover:bg-green-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-400 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40"
        >
          {state?.is_playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
      </div>
    </footer>
  )
}
