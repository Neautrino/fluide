import { formatWeekdayDate, plural } from './time'

const CELLS = 30

/** The last 30 days of an Enable Banking consent, one cell per day: used, today, days left. */
export function ConsentStrip({ daysLeft, validUntil }: { daysLeft: number; validUntil: string }) {
  const used = Math.max(0, CELLS - 1 - daysLeft)
  const left = Math.min(daysLeft, CELLS - 1)
  const ends = formatWeekdayDate(validUntil)
  return (
    <div
      role="img"
      aria-label={`Access: ${plural(daysLeft, 'day')} left, ends ${ends}`}
      className="mt-[5px] flex flex-wrap items-center gap-[1.5px] min-[1361px]:gap-0.5"
    >
      {Array.from({ length: used }, (_, i) => (
        <span key={`u${i}`} className="block h-[11px] w-[3px] rounded-[1px] bg-chart-muted min-[1361px]:w-1" />
      ))}
      <span className="block h-[15px] w-[3px] rounded-[1px] bg-chart-1 min-[1361px]:w-1" />
      {Array.from({ length: left }, (_, i) => (
        <span key={`l${i}`} className="block h-[11px] w-[3px] rounded-[1px] border border-warning min-[1361px]:w-1" />
      ))}
      <span className="mt-0.5 basis-full text-[11px] whitespace-nowrap text-ink-3">
        <b className="figures font-bold text-ink">{daysLeft}</b> {daysLeft === 1 ? 'day' : 'days'} left · ends {ends}
      </span>
    </div>
  )
}
