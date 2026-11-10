import { Button } from '@base-ui/react/button'
import type { Device, LoopStatus, NowPlaying, SleepStatus } from '../api'
import { Cover } from './Cover'
import { DevicePicker } from './DevicePicker'
import { PauseIcon, PlayIcon } from './icons'
import { LoopControl } from './LoopControl'
import { SleepTimer } from './SleepTimer'

type Props = {
  state: NowPlaying | null
  onToggle: () => void
  devices: Device[]
  onSelectDevice: (name: string) => void
  onRefreshDevices: () => void
  sleep: SleepStatus | null
  onStartSleep: (minutes: number) => void
  onCancelSleep: () => void
  loop: LoopStatus | null
  getPosition: () => Promise<number | null>
  onStartLoop: (a: number, b: number) => void
  onStopLoop: () => void
}

export function NowPlayingBar({
  state,
  onToggle,
  devices,
  onSelectDevice,
  onRefreshDevices,
  sleep,
  onStartSleep,
  onCancelSleep,
  loop,
  getPosition,
  onStartLoop,
  onStopLoop,
}: Props) {
  const track = state?.track ?? null
  const pct = (ms: number) => (track?.duration_ms ? Math.min(100, (ms / track.duration_ms) * 100) : 0)
  const progress = state?.progress_ms != null ? pct(state.progress_ms) : 0
  const looping = !!loop?.active && loop.track_uri === track?.uri && loop.a_ms != null && loop.b_ms != null

  const controls = (
    <>
      <DevicePicker devices={devices} onSelect={onSelectDevice} onOpen={onRefreshDevices} />
      <LoopControl track={track} status={loop} getPosition={getPosition} onStart={onStartLoop} onStop={onStopLoop} />
      <SleepTimer status={sleep} onStart={onStartSleep} onCancel={onCancelSleep} />
    </>
  )

  return (
    <footer className="fixed inset-x-0 bottom-0 border-t border-neutral-800 bg-neutral-900/95 backdrop-blur">
      {/* Progress only refreshes on each poll (every few seconds) */}
      <div className={`relative bg-neutral-800 transition-[height] ${looping ? 'h-1.5' : 'h-0.5'}`}>
        {looping && (
          <div
            aria-hidden="true"
            className="absolute inset-y-0 bg-green-500/30"
            style={{ left: `${pct(loop!.a_ms!)}%`, width: `${pct(loop!.b_ms!) - pct(loop!.a_ms!)}%` }}
          />
        )}
        <div className="relative h-full bg-green-500 transition-[width] duration-1000" style={{ width: `${progress}%` }} />
      </div>
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:gap-4">
        <Cover src={track?.image ?? null} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{track ? track.name : 'Nothing playing'}</p>
          <p className="truncate text-sm text-neutral-400">
            {track ? track.artists : 'Pick something above to start'}
            {state?.device && <span className="text-neutral-500"> · on {state.device}</span>}
          </p>
        </div>
        <div className="hidden items-center gap-2 sm:flex">{controls}</div>
        <Button
          onClick={onToggle}
          aria-label={state?.is_playing ? 'Pause' : 'Play'}
          className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-green-500 text-neutral-950 transition hover:scale-105 hover:bg-green-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-400 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40"
        >
          {state?.is_playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
      </div>
      {/* On phones the extra controls get their own row */}
      <div className="flex items-center gap-2 px-4 pb-3 sm:hidden">{controls}</div>
    </footer>
  )
}
