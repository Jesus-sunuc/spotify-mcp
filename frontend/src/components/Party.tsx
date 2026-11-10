import { Button } from '@base-ui/react/button'
import { Input } from '@base-ui/react/input'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api'
import type { PartyHostState } from '../api'
import { Cover } from './Cover'
import { TrashIcon } from './icons'

type Props = {
  state: PartyHostState | null
  onStart: () => void
  onEnd: () => void
  onSetHost: (host: string) => void
  onRemove: (id: number, name: string) => void
  onCopied: () => void
}

export function Party({ state, onStart, onEnd, onSetHost, onRemove, onCopied }: Props) {
  return (
    <section aria-labelledby="party-heading">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 id="party-heading" className="text-lg font-semibold">
            Party jukebox
          </h2>
          <p className="text-xs text-neutral-500">Guests scan a QR code, add songs and vote. The top song plays next.</p>
        </div>
        {state?.active ? (
          <Button onClick={onEnd} className="cursor-pointer rounded-full bg-neutral-800 px-4 py-1.5 text-sm font-medium text-red-200 hover:bg-red-950">
            End party
          </Button>
        ) : (
          <Button
            onClick={onStart}
            disabled={!state}
            className="cursor-pointer rounded-full bg-green-500 px-4 py-1.5 text-sm font-semibold text-neutral-950 hover:bg-green-400 data-[disabled]:opacity-40"
          >
            Start a party
          </Button>
        )}
      </div>

      {state?.active && (
        <div className="grid gap-6 rounded-2xl border border-neutral-800 p-4 md:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-3">
            {state.url ? (
              <img src={api.partyQrUrl(state.url)} alt="QR code for guests to join the party" className="size-48 rounded-xl bg-white p-1" />
            ) : (
              <div className="grid size-48 place-items-center rounded-xl border border-dashed border-neutral-700 p-4 text-center text-xs text-neutral-500">
                Set your Mac's address below to get a QR code
              </div>
            )}
            {state.url && (
              <Button
                onClick={() => navigator.clipboard.writeText(state.url!).then(onCopied)}
                className="cursor-pointer text-xs text-neutral-400 underline-offset-2 hover:text-white hover:underline"
              >
                Copy guest link
              </Button>
            )}
            <HostField key={state.host} host={state.host} port={state.port} onSave={onSetHost} />
          </div>

          <div className="min-w-0">
            <h3 className="mb-2 text-sm font-semibold text-neutral-300">Up next ({state.songs.length})</h3>
            {state.songs.length === 0 && <p className="text-sm text-neutral-500">No requests yet. Guests' songs show up here.</p>}
            <ol className="space-y-1">
              {state.songs.map((s, i) => (
                <li key={s.id} className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-neutral-900">
                  <span className="w-4 text-xs text-neutral-500 tabular-nums">{i + 1}</span>
                  <Cover src={s.image} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="truncate text-xs text-neutral-400">
                      {s.artists} · by {s.added_by}
                    </p>
                  </div>
                  <span className="text-sm text-green-400 tabular-nums" title="Votes">
                    ♥ {s.votes}
                  </span>
                  <Button
                    onClick={() => onRemove(s.id, s.name)}
                    aria-label={`Remove ${s.name}`}
                    title="Remove"
                    className="grid size-8 cursor-pointer place-items-center rounded-full text-neutral-500 hover:bg-neutral-800 hover:text-red-300"
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-neutral-500">
              About 25s before each song ends, the top song is added to Spotify's queue. Keep something playing.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

/** Address of this Mac on the Wi-Fi (e.g. jesust.local). Guests' phones must be on the same network. */
function HostField({ host, port, onSave }: { host: string; port: string; onSave: (host: string) => void }) {
  const [value, setValue] = useState(host)
  function submit(e: FormEvent) {
    e.preventDefault()
    if (value.trim() && value.trim() !== host) onSave(value.trim())
  }
  return (
    <form onSubmit={submit} className="w-48">
      <label htmlFor="party-host" className="mb-1 block text-[11px] text-neutral-500">
        Mac's Wi-Fi address (port {port})
      </label>
      <div className="flex gap-1">
        <Input
          id="party-host"
          value={value}
          onValueChange={(v) => setValue(v)}
          placeholder="jesust.local"
          className="min-w-0 flex-1 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs focus:border-green-500 focus:outline-none"
        />
        <Button type="submit" className="cursor-pointer rounded-md bg-neutral-800 px-2 text-xs hover:bg-neutral-700">
          Save
        </Button>
      </div>
    </form>
  )
}
