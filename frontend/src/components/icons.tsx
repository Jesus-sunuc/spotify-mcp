type Props = { className?: string }

export const PlayIcon = ({ className = 'size-5' }: Props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11.1-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" />
  </svg>
)

export const PauseIcon = ({ className = 'size-5' }: Props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
    <rect x="6" y="4.5" width="4" height="15" rx="1" />
    <rect x="14" y="4.5" width="4" height="15" rx="1" />
  </svg>
)

export const QueueIcon = ({ className = 'size-5' }: Props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className={className}>
    <path d="M4 6h12M4 12h12M4 18h7M18 15v6M15 18h6" />
  </svg>
)

export const SearchIcon = ({ className = 'size-5' }: Props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const SpeakerIcon = ({ className = 'size-5' }: Props) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true" className={className}>
    <rect x="5" y="2" width="14" height="20" rx="2" />
    <circle cx="12" cy="14" r="4" />
    <path d="M12 6h.01" />
  </svg>
)

export const MoonIcon = ({ className = 'size-5' }: Props) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true" className={className}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </svg>
)

export const AlarmIcon = ({ className = 'size-5' }: Props) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true" className={className}>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3" />
  </svg>
)

export const TrashIcon = ({ className = 'size-5' }: Props) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true" className={className}>
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </svg>
)

export const PlusIcon = ({ className = 'size-5' }: Props) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true" className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const CheckIcon = ({ className = 'size-4' }: Props) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true" className={className}>
    <path d="m5 12 5 5L20 7" />
  </svg>
)

export const ChevronIcon = ({ className = 'size-4' }: Props) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true" className={className}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)

export const LoopIcon = ({ className = 'size-5' }: Props) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true" className={className}>
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </svg>
)

export const RefreshIcon = ({ className = 'size-4' }: Props) => (
  <svg viewBox="0 0 24 24" {...stroke} aria-hidden="true" className={className}>
    <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
    <path d="M21 3v5h-5" />
  </svg>
)

export const MusicIcon =({ className = 'size-5' }: Props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className={className}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
)
