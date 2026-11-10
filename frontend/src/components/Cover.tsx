import { MusicIcon } from './icons'

/** Album/artist/playlist image with a placeholder when Spotify returns none. */
export function Cover({ src, round = false, className = 'size-12' }: { src: string | null; round?: boolean; className?: string }) {
  const shape = round ? 'rounded-full' : 'rounded-md'
  if (!src) {
    return (
      <div className={`${className} ${shape} grid shrink-0 place-items-center bg-neutral-800 text-neutral-500`}>
        <MusicIcon />
      </div>
    )
  }
  return <img src={src} alt="" loading="lazy" className={`${className} ${shape} shrink-0 object-cover`} />
}
