function getLocalDateStr(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export type DayGroup<R> = { date: string; rows: R[]; label: string; isToday: boolean; dayNum: string; monthShort: string }

export function groupByDay<R extends { date: string }>(rows: R[]): DayGroup<R>[] {
  const groups: DayGroup<R>[] = []
  const todayDate = new Date()
  const todayStr = getLocalDateStr(todayDate)
  const yesterdayDate = new Date(todayDate)
  yesterdayDate.setDate(todayDate.getDate() - 1)
  const yesterdayStr = getLocalDateStr(yesterdayDate)

  const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' })
  const monthShortFormat = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' })

  for (const r of rows) {
    const date = r.date.slice(0, 10)
    let g = groups[groups.length - 1]
    if (!g || g.date !== date) {
      const d = new Date(r.date)
      let label = weekdayFormat.format(d)
      if (date === todayStr) label = 'Today'
      else if (date === yesterdayStr) label = 'Yesterday'

      g = {
        date,
        rows: [],
        label,
        isToday: date === todayStr,
        dayNum: String(d.getUTCDate()),
        monthShort: monthShortFormat.format(d),
      }
      groups.push(g)
    }
    g.rows.push(r)
  }
  return groups
}
