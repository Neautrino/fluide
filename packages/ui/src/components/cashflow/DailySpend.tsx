import type { CashFlow } from '../../types'
import { Empty } from '../ui/States'
import { AMOUNT_HIDDEN, useAmountsHidden } from './amounts'
import { monthOnly, monthStart } from './figures'
import { Amt, Card, useDrill } from './primitives'
import { compactMoney, money } from './shared'

const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' })
const dayMonth = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })

const SHADE = [
  'bg-surface',
  'bg-[color-mix(in_srgb,var(--chart-1)_8%,var(--surface))]',
  'bg-[color-mix(in_srgb,var(--chart-1)_20%,var(--surface))]',
  'bg-[color-mix(in_srgb,var(--chart-1)_38%,var(--surface))] [html[data-theme=dark]_&]:bg-[color-mix(in_srgb,var(--chart-1)_30%,var(--surface))]',
  'bg-[color-mix(in_srgb,var(--chart-1)_60%,var(--surface))] text-ink-inverse',
  'bg-[color-mix(in_srgb,var(--chart-1)_88%,var(--surface))] text-ink-inverse',
]

const MONDAYS = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2024, 0, 1 + i)))

type Day = { day: number; date: Date; out: number | null }

/** Money out per day is the step between neighbouring points of the cumulative pace line. */
function dailyOut(data: CashFlow): Day[] {
  const [y, m] = data.month.split('-').map(Number)
  const cumulative = new Map(data.pace.map((p) => [p.day, p.current]))
  let prev = 0
  return Array.from({ length: data.daysInMonth }, (_, i) => {
    const day = i + 1
    const current = cumulative.get(day) ?? null
    const known = current !== null && (!data.partial || day <= data.daysElapsed)
    const out = known ? Math.round((current - prev) * 100) / 100 : null
    if (known) prev = current
    return { day, date: new Date(Date.UTC(y, m - 1, day)), out }
  })
}

/** Whole units, except under 10 where rounding would erase the figure. */
function perDay(value: number, currency: string): string {
  return money(value, currency, { whole: value >= 10 })
}

/** Shade 1-5 by rank among the month's non-zero days, so the scale always uses the whole range. */
function shadeOf(value: number, spent: number[]): number {
  const below = spent.filter((v) => v < value).length
  return Math.min(5, 1 + Math.floor((below / spent.length) * 5))
}

export function DailySpend({ data }: { data: CashFlow }) {
  const open = useDrill()
  const hidden = useAmountsHidden()
  const { currency } = data

  if (data.pace.length === 0) {
    return (
      <Card title="Daily spend">
        <Empty title="No daily figures for this month" />
      </Card>
    )
  }

  const days = dailyOut(data)
  const withSpend = days.flatMap((d) => (d.out !== null && d.out > 0 ? [{ ...d, out: d.out }] : []))
  const spent = withSpend.map((d) => d.out)
  const busiest = withSpend.reduce<(typeof withSpend)[number] | null>((best, d) => (best === null || d.out > best.out ? d : best), null)
  const lead = (monthStart(data.month).getUTCDay() + 6) % 7
  const counted = days.filter((d) => d.out !== null).length
  const label = (d: Day) => `${weekday.format(d.date)} ${dayMonth.format(d.date)}`
  const say = (v: number) => (hidden ? AMOUNT_HIDDEN : money(v, currency))

  return (
    <Card
      title="Daily spend"
      sub={`${monthOnly.format(monthStart(data.month))} · money out per day`}
    >
      <div className="@container">
        <div className="grid grid-cols-1 gap-x-[18px] gap-y-4 @[460px]:grid-cols-[minmax(0,1fr)_150px]">
          <div className="grid grid-cols-7 gap-[5px]">
            {MONDAYS.map((d) => (
              <div key={d.getTime()} aria-hidden className="text-center text-[10.5px] font-bold tracking-[0.06em] text-ink-3 uppercase">
                {weekday.format(d).slice(0, 2)}
              </div>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <div key={`pad${i}`} aria-hidden />
            ))}
            {days.map((d) => {
              const base =
                'flex h-[46px] min-w-0 flex-col justify-between overflow-hidden rounded-sm px-1 py-[5px] text-left text-[11px] min-[1360px]:px-[7px]'
              if (d.out === null) {
                return (
                  <div
                    key={d.day}
                    title={`${label(d)}: not yet`}
                    className={`${base} border-[1.5px] border-dashed border-line-strong text-ink-3`}
                  >
                    <span className="font-bold">{d.day}</span>
                    <span className="self-end text-[10.5px] font-semibold">—</span>
                  </div>
                )
              }
              const out = d.out
              const today = data.partial && d.day === data.daysElapsed
              const cls = `${base} border ${out > 0 ? 'border-transparent' : 'border-line'} ${SHADE[out > 0 ? shadeOf(out, spent) : 0]} ${
                today ? 'shadow-[0_0_0_1.5px_var(--surface),0_0_0_3px_var(--line-strong)]' : ''
              }`
              const cell = (
                <>
                  <span className="font-bold">{d.day}</span>
                  {out > 0 && <Amt className="self-end text-[9.5px] font-semibold min-[1360px]:text-[10.5px]">{compactMoney(out, currency)}</Amt>}
                </>
              )
              const aria = `${label(d)}: ${out > 0 ? `${say(out)} out` : 'nothing out'}${today ? ', today so far' : ''}`
              return out > 0 ? (
                <button
                  key={d.day}
                  type="button"
                  title={aria}
                  aria-label={aria}
                  onClick={() => open({ token: `day:${d.day}`, label: label(d), amount: out })}
                  className={`${cls} hover:brightness-95`}
                >
                  {cell}
                </button>
              ) : (
                <div key={d.day} title={aria} className={cls}>
                  {cell}
                </div>
              )
            })}
          </div>
          <div className="flex flex-row flex-wrap gap-x-8 gap-y-3 text-[12px] text-ink-2 @[460px]:flex-col @[460px]:flex-nowrap @[460px]:gap-y-3.5">
            {busiest && (
              <div>
                Busiest day · {weekday.format(busiest.date)} {busiest.day}
                <b className="mt-0.5 block font-display text-[18px] font-extrabold tracking-[-0.02em] text-ink">
                  <Amt>{perDay(busiest.out, currency)}</Amt>
                </b>
              </div>
            )}
            {counted > 0 && (
              <div>
                Daily average
                <b className="mt-0.5 block font-display text-[18px] font-extrabold tracking-[-0.02em] text-ink">
                  <Amt>{perDay(data.totals.moneyOut / counted, currency)}</Amt>
                </b>
                <span className="text-[11px] text-ink-3">
                  {counted} {counted === 1 ? 'day' : 'days'}
                </span>
              </div>
            )}
            {spent.length > 0 && (
              <div className="flex flex-col gap-1 text-[11px] text-ink-3">
                <span className="flex items-center gap-1.5">
                  Less
                  {SHADE.slice(1).map((s, i) => (
                    <i key={i} aria-hidden className={`block h-3 w-4 rounded-[3px] ${s}`} />
                  ))}
                  More
                </span>
                <span>
                  <Amt>{compactMoney(Math.min(...spent), currency)}</Amt> to <Amt>{compactMoney(Math.max(...spent), currency)}</Amt>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="mt-3 text-[11.5px] text-ink-3">
        {data.partial ? 'Ringed = today · dashed = not yet · click a day for its transactions' : 'Click a day for its transactions'}
      </p>
    </Card>
  )
}
