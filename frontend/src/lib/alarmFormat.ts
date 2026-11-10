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

/** '06:30' -> '6:30 AM' */
export function formatTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
