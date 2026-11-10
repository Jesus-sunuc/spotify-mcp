import { Select } from '@base-ui/react/select'
import type { Device } from '../api'
import { CheckIcon, ChevronIcon, SpeakerIcon } from './icons'

type Props = {
  devices: Device[]
  onSelect: (name: string) => void
  onOpen: () => void // refresh the list when opened (devices come and go)
}

export function DevicePicker({ devices, onSelect, onOpen }: Props) {
  const selected = devices.find((d) => d.selected)?.name ?? null
  return (
    <Select.Root
      value={selected}
      onValueChange={(v) => v && v !== selected && onSelect(v)}
      onOpenChange={(open) => open && onOpen()}
      items={Object.fromEntries(devices.map((d) => [d.name, d.name]))}
    >
      <Select.Trigger
        aria-label="Playback device"
        className="flex max-w-44 cursor-pointer items-center gap-2 rounded-full border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white focus-visible:outline-2 focus-visible:outline-green-400"
      >
        <SpeakerIcon className="size-4 shrink-0" />
        <span className="truncate">
          <Select.Value placeholder="No device" />
        </span>
        <Select.Icon className="shrink-0">
          <ChevronIcon className="size-3.5" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner side="top" sideOffset={8} alignItemWithTrigger={false} className="z-50">
          <Select.Popup className="min-w-56 rounded-xl border border-neutral-700 bg-neutral-900 p-1 shadow-xl">
            {devices.length === 0 && <p className="p-3 text-sm text-neutral-500">No devices found</p>}
            {devices.map((d) => (
              <Select.Item
                key={d.name}
                value={d.name}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none select-none data-[highlighted]:bg-neutral-800"
              >
                <Select.ItemIndicator className="w-4 text-green-400">
                  <CheckIcon />
                </Select.ItemIndicator>
                <Select.ItemText className="flex-1">{d.name}</Select.ItemText>
                {d.is_active && <span className="text-xs text-green-400">playing</span>}
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}
