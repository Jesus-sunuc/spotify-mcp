export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const same = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i])

/** [0,1,2,3,4] -> 'Weekdays', [] -> 'Once', [0,2] -> 'Mon, Wed' */
export function describeDays(days: number[]) {
  if (days.length === 0) return 'Once'
  if (days.length === 7) return 'Every day'
  if (same(days, [0, 1, 2, 3, 4])) return 'Weekdays'
  if (same(days, [5, 6])) return 'Weekends'
  return days.map((d) => DAYS[d]).join(', ')
}

/** 83456 -> '1:23.4' */
export function formatMs(ms: number) {
  const s = ms / 1000
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`
}

/** '2026-09-25' -> 'Sep 25' (local date, no timezone shift) */
export function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** '06:30' -> '6:30 AM' */
export function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
