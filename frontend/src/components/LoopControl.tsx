import { Button } from '@base-ui/react/button'
import { Popover } from '@base-ui/react/popover'
import { useState } from 'react'
import type { LoopStatus, Track } from '../api'
import { formatMs } from '../lib/alarmFormat'
import { LoopIcon } from './icons'

type Props = {
  track: Track | null
  status: LoopStatus | null
  /** Fresh playback position from the backend (more accurate than the last poll). */
  getPosition: () => Promise<number | null>
  onStart: (a: number, b: number) => void
  onStop: () => void
}

const small =
  'cursor-pointer rounded-md border border-neutral-700 px-2 py-1 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40'

export function LoopControl({ track, status, getPosition, onStart, onStop }: Props) {
  const active = !!status?.active && status.track_uri === track?.uri
  return (
    <Popover.Root>
      <Popover.Trigger
        disabled={!track}
        aria-label={active ? 'A-B loop on' : 'A-B loop'}
        className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-2 focus-visible:outline-green-400 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 ${
          active
            ? 'border-green-500/50 bg-green-500/10 text-green-300'
            : 'border-neutral-700 text-neutral-300 hover:border-neutral-500 hover:text-white'
        }`}
      >
        <LoopIcon className="size-4" />
        <span className="text-xs font-semibold">A-B</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" sideOffset={8} className="z-50">
          <Popover.Popup className="w-72 rounded-xl border border-neutral-700 bg-neutral-900 p-4 shadow-xl">
            {/* Remount the editor when the song changes so stale A/B points are dropped */}
            {track && <LoopEditor key={track.uri} track={track} status={status} active={active} getPosition={getPosition} onStart={onStart} onStop={onStop} />}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

function LoopEditor({ track, status, active, getPosition, onStart, onStop }: Props & { track: Track; active: boolean }) {
  const [a, setA] = useState<number | null>(active ? status!.a_ms : null)
  const [b, setB] = useState<number | null>(active ? status!.b_ms : null)
  const duration = track.duration_ms ?? Infinity
  const clamp = (v: number) => Math.max(0, Math.min(duration, v))
  const valid = a != null && b != null && b - a >= 2000

  const point = (label: 'A' | 'B', value: number | null, set: (v: number) => void) => (
    <div className="flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-full bg-neutral-800 text-xs font-bold text-green-400">{label}</span>
      <span className="w-16 text-sm tabular-nums">{value == null ? '—' : formatMs(value)}</span>
      <Button
        className={small}
        onClick={async () => {
          const pos = await getPosition()
          if (pos != null) set(pos)
        }}
      >
        Set to now
      </Button>
      <Button className={small} disabled={value == null} onClick={() => set(clamp(value! - 500))} aria-label={`${label} back half a second`}>
        −½s
      </Button>
      <Button className={small} disabled={value == null} onClick={() => set(clamp(value! + 500))} aria-label={`${label} forward half a second`}>
        +½s
      </Button>
    </div>
  )

  return (
    <>
      <Popover.Title className="text-sm font-semibold">Loop a section</Popover.Title>
      <Popover.Description className="mt-0.5 truncate text-xs text-neutral-400">{track.name}</Popover.Description>
      <div className="mt-4 space-y-2">
        {point('A', a, setA)}
        {point('B', b, setB)}
      </div>
      {a != null && b != null && !valid && <p className="mt-2 text-xs text-amber-300">B must be at least 2 seconds after A.</p>}
      {!active && status?.stopped_reason && status.stopped_reason !== 'stopped' && (
        <p className="mt-2 text-xs text-neutral-500">Last loop stopped: {status.stopped_reason}.</p>
      )}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-[11px] leading-tight text-neutral-500">Precision ≈ ±½s; pausing or skipping ends the loop.</p>
        {active ? (
          <Button onClick={onStop} className="cursor-pointer rounded-full bg-neutral-800 px-4 py-1.5 text-sm font-medium hover:bg-neutral-700">
            Stop
          </Button>
        ) : (
          <Button
            disabled={!valid}
            onClick={() => valid && onStart(a!, b!)}
            className="cursor-pointer rounded-full bg-green-500 px-4 py-1.5 text-sm font-semibold text-neutral-950 hover:bg-green-400 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40"
          >
            Loop
          </Button>
        )}
      </div>
    </>
  )
}
