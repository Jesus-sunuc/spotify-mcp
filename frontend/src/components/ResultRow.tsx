import { Button } from '@base-ui/react/button'
import type { ReactNode } from 'react'
import { Cover } from './Cover'
import { PlayIcon, QueueIcon } from './icons'

type Props = {
  image: string | null
  round?: boolean
  title: string
  subtitle: ReactNode
  onPlay: () => void
  onQueue?: () => void
}

const iconButton =
  'grid size-9 cursor-pointer place-items-center rounded-full text-neutral-300 transition hover:bg-neutral-700 hover:text-white focus-visible:outline-2 focus-visible:outline-green-400'

export function ResultRow({ image, round, title, subtitle, onPlay, onQueue }: Props) {
  return (
    <li className="group flex items-center gap-3 rounded-lg p-2 transition hover:bg-neutral-900">
      <Cover src={image} round={round} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        <p className="truncate text-sm text-neutral-400">{subtitle}</p>
      </div>
      {onQueue && (
        <Button onClick={onQueue} aria-label={`Add ${title} to queue`} title="Add to queue" className={iconButton}>
          <QueueIcon className="size-4" />
        </Button>
      )}
      <Button
        onClick={onPlay}
        aria-label={`Play ${title}`}
        title="Play"
        className={`${iconButton} bg-green-500/10 text-green-400 hover:bg-green-500 hover:text-neutral-950`}
      >
        <PlayIcon className="size-4" />
      </Button>
    </li>
  )
}
