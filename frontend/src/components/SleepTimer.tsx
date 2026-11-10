import { Menu } from '@base-ui/react/menu'
import type { SleepStatus } from '../api'
import { MoonIcon } from './icons'

type Props = {
  status: SleepStatus | null
  onStart: (minutes: number) => void
  onCancel: () => void
}

const OPTIONS = [15, 30, 45, 60, 90]

function minutesLeft(endsAt: string) {
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 60_000))
}

const item =
  'flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm outline-none select-none data-[highlighted]:bg-neutral-800'

export function SleepTimer({ status, onStart, onCancel }: Props) {
  const active = status?.active && status.ends_at
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={active ? `Sleep timer: ${minutesLeft(status.ends_at!)} minutes left` : 'Sleep timer'}
        className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition focus-visible:outline-2 focus-visible:outline-green-400 ${
          active
            ? 'border-green-500/50 bg-green-500/10 text-green-300'
            : 'border-neutral-700 text-neutral-300 hover:border-neutral-500 hover:text-white'
        }`}
      >
        <MoonIcon className="size-4" />
        {active && <span className="tabular-nums">{minutesLeft(status.ends_at!)}m</span>}
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="top" sideOffset={8} className="z-50">
          <Menu.Popup className="w-56 rounded-xl border border-neutral-700 bg-neutral-900 p-1 shadow-xl">
            <p className="px-3 pt-2 pb-1 text-xs text-neutral-500">Fade out and pause after…</p>
            {OPTIONS.map((m) => (
              <Menu.Item key={m} onClick={() => onStart(m)} className={item}>
                {m} minutes
              </Menu.Item>
            ))}
            {active && (
              <>
                <div className="my-1 h-px bg-neutral-800" />
                <Menu.Item onClick={onCancel} className={`${item} text-red-300`}>
                  Turn off ({minutesLeft(status.ends_at!)}m left)
                </Menu.Item>
              </>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
