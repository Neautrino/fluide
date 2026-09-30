const weekdayDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
const monthShort = new Intl.DateTimeFormat(undefined, { month: 'short' })

/** Day of month and short month in the viewer's time zone, for the date chip. */
export function chipParts(iso: string): { day: string; month: string } | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return { day: String(d.getDate()), month: monthShort.format(d) }
}

export function formatWeekdayDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : weekdayDate.format(d)
}

export function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}
