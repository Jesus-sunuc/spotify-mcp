import { Button } from '@base-ui/react/button'
import { Dialog } from '@base-ui/react/dialog'
import { Input } from '@base-ui/react/input'
import { Slider } from '@base-ui/react/slider'
import { Switch } from '@base-ui/react/switch'
import { Toggle } from '@base-ui/react/toggle'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api'
import type { Alarm, NewAlarm } from '../api'
import { DAYS, describeDays, formatTime } from '../lib/alarmFormat'
import { Cover } from './Cover'
import { AlarmIcon, CheckIcon, PlayIcon, PlusIcon, TrashIcon } from './icons'

const iconButton =
  'grid size-9 cursor-pointer place-items-center rounded-full text-neutral-400 transition hover:bg-neutral-800 hover:text-white focus-visible:outline-2 focus-visible:outline-green-400'

// ---------- list ----------

type Props = {
  alarms: Alarm[] | null
  onCreate: (alarm: NewAlarm) => Promise<boolean>
  onToggle: (alarm: Alarm, enabled: boolean) => void
  onDelete: (alarm: Alarm) => void
  onTest: (alarm: Alarm) => void
  onError: (message: string) => void
}

export function Alarms({ alarms, onCreate, onToggle, onDelete, onTest, onError }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <section aria-labelledby="alarms-heading">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="alarms-heading" className="text-lg font-semibold">
          Wake-up alarms
        </h2>
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger className="flex cursor-pointer items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1.5 text-sm font-medium transition hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-green-400">
            <PlusIcon className="size-4" /> New alarm
          </Dialog.Trigger>
          <AlarmDialog
            onError={onError}
            onSave={async (a) => {
              if (await onCreate(a)) setOpen(false)
            }}
          />
        </Dialog.Root>
      </div>

      {!alarms && <p className="text-sm text-neutral-500">Loading…</p>}
      {alarms?.length === 0 && (
        <p className="rounded-lg border border-dashed border-neutral-800 p-4 text-sm text-neutral-500">
          No alarms yet. Music starts quietly on your selected device and slowly gets louder.
        </p>
      )}
      <ul className="space-y-2">
        {alarms?.map((a) => (
          <li
            key={a.id}
            className={`flex items-center gap-4 rounded-xl border border-neutral-800 p-3 transition ${a.enabled ? '' : 'opacity-50'}`}
          >
            <div className="w-28 shrink-0">
              <p className="text-2xl font-semibold tabular-nums">{formatTime(a.time)}</p>
              <p className="text-xs text-neutral-400">{describeDays(a.days)}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{a.label}</p>
              <p className="text-xs text-neutral-500">
                Up to {a.target_volume}% over {a.ramp_minutes} min
              </p>
            </div>
            <Button onClick={() => onTest(a)} aria-label={`Test ${a.label} alarm now`} title="Test now (1-min ramp)" className={iconButton}>
              <PlayIcon className="size-4" />
            </Button>
            <Button onClick={() => onDelete(a)} aria-label={`Delete ${formatTime(a.time)} alarm`} title="Delete" className={`${iconButton} hover:text-red-300`}>
              <TrashIcon className="size-4" />
            </Button>
            <Switch.Root
              checked={a.enabled}
              onCheckedChange={(v) => onToggle(a, v)}
              aria-label={`${a.enabled ? 'Disable' : 'Enable'} ${formatTime(a.time)} alarm`}
              className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full bg-neutral-700 transition data-[checked]:bg-green-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-400"
            >
              <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition data-[checked]:translate-x-[22px]" />
            </Switch.Root>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---------- new-alarm dialog ----------

type Choice = { uri: string; label: string; image: string | null }
type Kind = 'playlist' | 'artist' | 'track'
const KINDS: { value: Kind; label: string }[] = [
  { value: 'playlist', label: 'Playlist' },
  { value: 'artist', label: 'Artist' },
  { value: 'track', label: 'Song' },
]

const field = 'mb-1.5 block text-xs font-medium tracking-wide text-neutral-400 uppercase'
const chip =
  'cursor-pointer rounded-full border border-neutral-700 px-3 py-1 text-sm text-neutral-300 transition hover:border-neutral-500 data-[pressed]:border-green-500 data-[pressed]:bg-green-500/15 data-[pressed]:text-green-200 focus-visible:outline-2 focus-visible:outline-green-400'

function AlarmDialog({ onSave, onError }: { onSave: (a: NewAlarm) => Promise<void>; onError: (m: string) => void }) {
  const [time, setTime] = useState('07:00')
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4])
  const [kind, setKind] = useState<Kind>('playlist')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Choice[]>([])
  const [choice, setChoice] = useState<Choice | null>(null)
  const [volume, setVolume] = useState(35)
  const [ramp, setRamp] = useState(10)
  const [saving, setSaving] = useState(false)

  async function search(e?: FormEvent) {
    e?.preventDefault()
    if (!query.trim()) return
    try {
      const items = await api.search(query.trim(), kind)
      setResults(
        items.slice(0, 5).map((x) => ({
          uri: x.uri,
          label: 'artists' in x && kind === 'track' ? `${x.name} – ${x.artists}` : x.name,
          image: x.image,
        })),
      )
    } catch (err) {
      onError((err as Error).message)
    }
  }

  async function save() {
    if (!choice) return
    setSaving(true)
    await onSave({ time, days: [...days].sort(), uri: choice.uri, label: choice.label, target_volume: volume, ramp_minutes: ramp })
    setSaving(false)
  }

  return (
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
      <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-950 p-6 shadow-2xl">
        <Dialog.Title className="flex items-center gap-2 text-lg font-semibold">
          <AlarmIcon className="size-5 text-green-400" /> New wake-up alarm
        </Dialog.Title>
        <Dialog.Description className="mt-1 text-sm text-neutral-400">
          Starts at 5% on your selected device and fades up to your volume.
        </Dialog.Description>

        <div className="mt-6 space-y-5">
          {/* time */}
          <div>
            <label htmlFor="alarm-time" className={field}>
              Time
            </label>
            <input
              id="alarm-time"
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-2xl tabular-nums focus:border-green-500 focus:outline-none"
            />
          </div>

          {/* days */}
          <div>
            <span className={field}>Repeat {days.length === 0 && <span className="normal-case">(once)</span>}</span>
            <ToggleGroup
              multiple
              value={days.map(String)}
              onValueChange={(v) => setDays(v.map(Number))}
              aria-label="Repeat on days"
              className="flex flex-wrap gap-1.5"
            >
              {DAYS.map((d, i) => (
                <Toggle key={d} value={String(i)} aria-label={d} className={chip}>
                  {d[0]}
                  {d === 'Thu' || d === 'Sun' ? d[1] : ''}
                </Toggle>
              ))}
            </ToggleGroup>
          </div>

          {/* what to play */}
          <div>
            <span className={field}>Wake up to</span>
            {choice ? (
              <div className="flex items-center gap-3 rounded-lg border border-green-500/40 bg-green-500/5 p-2">
                <Cover src={choice.image} className="size-10" />
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{choice.label}</p>
                <Button onClick={() => setChoice(null)} className="cursor-pointer px-2 text-sm text-neutral-400 hover:text-white">
                  Change
                </Button>
              </div>
            ) : (
              <>
                <ToggleGroup
                  value={[kind]}
                  onValueChange={(v) => v[0] && (setKind(v[0] as Kind), setResults([]))}
                  aria-label="Search for"
                  className="mb-2 flex gap-1.5"
                >
                  {KINDS.map((k) => (
                    <Toggle key={k.value} value={k.value} className={chip}>
                      {k.label}
                    </Toggle>
                  ))}
                </ToggleGroup>
                <form onSubmit={search} className="flex gap-2">
                  <Input
                    value={query}
                    onValueChange={(v) => setQuery(v)}
                    placeholder={`Search ${kind === 'track' ? 'songs' : `${kind}s`}…`}
                    aria-label="Search what to wake up to"
                    className="min-w-0 flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                  />
                  <Button type="submit" className="cursor-pointer rounded-lg bg-neutral-800 px-3 text-sm hover:bg-neutral-700">
                    Search
                  </Button>
                </form>
                <ul className="mt-2 space-y-1">
                  {results.map((r) => (
                    <li key={r.uri}>
                      <Button
                        onClick={() => setChoice(r)}
                        className="flex w-full cursor-pointer items-center gap-3 rounded-lg p-1.5 text-left text-sm hover:bg-neutral-900"
                      >
                        <Cover src={r.image} round={kind === 'artist'} className="size-9" />
                        <span className="truncate">{r.label}</span>
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* volume + ramp */}
          {[
            { label: 'Volume', value: volume, set: setVolume, min: 5, max: 100, unit: '%' },
            { label: 'Fade in over', value: ramp, set: setRamp, min: 0, max: 30, unit: ' min' },
          ].map((s) => (
            <div key={s.label}>
              <span className={`${field} flex justify-between`}>
                {s.label}
                <span className="text-neutral-200 normal-case tabular-nums">
                  {s.value}
                  {s.unit}
                </span>
              </span>
              <Slider.Root value={s.value} onValueChange={(v) => s.set(v as number)} min={s.min} max={s.max}>
                <Slider.Control className="flex h-5 w-full cursor-pointer items-center">
                  <Slider.Track className="h-1.5 w-full rounded-full bg-neutral-800">
                    <Slider.Indicator className="rounded-full bg-green-500" />
                    <Slider.Thumb aria-label={s.label} className="size-4 rounded-full bg-white shadow focus-visible:outline-2 focus-visible:outline-green-400" />
                  </Slider.Track>
                </Slider.Control>
              </Slider.Root>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-end gap-2">
          <Dialog.Close className="cursor-pointer rounded-full px-4 py-2 text-sm text-neutral-300 hover:text-white">Cancel</Dialog.Close>
          <Button
            onClick={save}
            disabled={!choice || saving}
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-green-500 px-5 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-green-400 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40"
          >
            <CheckIcon /> Save alarm
          </Button>
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  )
}
