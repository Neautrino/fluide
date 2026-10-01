import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { CashFlow, CashFlowCompare } from '../../lib/api'
import { Select } from '../ui/Field'
import { Segmented } from '../ui/Segmented'
import { currentMonth, daysIn, monthLong, monthStart, shiftMonth } from './figures'
import { Chevron } from './primitives'

const PILL =
  'inline-flex h-[34px] items-center gap-2 rounded-full border border-line bg-surface px-3 text-[12.5px] whitespace-nowrap text-ink transition-colors hover:border-line-strong'

const COMPARE_OPTIONS: { value: CashFlowCompare; label: string }[] = [
  { value: 'average', label: 'Average' },
  { value: 'previous', label: 'Previous' },
  { value: 'last_year', label: 'Last year' },
]

function monthRange(month: string): string {
  const partial = month === currentMonth()
  const end = partial ? new Date().getUTCDate() : daysIn(month)
  const d = monthStart(month)
  const short = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' }).format(d)
  return `1–${end} ${short} ${d.getUTCFullYear()}${partial ? ' · to date' : ''}`
}

function Popover({
  button,
  buttonClassName,
  label,
  align = 'left',
  children,
}: {
  button: ReactNode
  buttonClassName: string
  label: string
  align?: 'left' | 'right'
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        className={buttonClassName}
      >
        {button}
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          className={`absolute top-full z-30 mt-2 w-max max-w-[340px] rounded-md border border-line bg-surface p-4 text-[13px] text-ink-2 shadow-2 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  )
}

function AccountFilter({
  all,
  selected,
  onChange,
}: {
  all: CashFlow['accounts']
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const label =
    selected.length === 0
      ? `All accounts (${all.length})`
      : selected.length === 1
        ? (all.find((a) => a.id === selected[0])?.name ?? '1 account')
        : `${selected.length} of ${all.length} accounts`
  const toggle = (id: string) => {
    const current = selected.length === 0 ? all.map((a) => a.id) : selected
    const next = current.includes(id) ? current.filter((s) => s !== id) : [...current, id]
    if (next.length > 0) onChange(next.length === all.length ? [] : next)
  }
  return (
    <Popover
      label="Accounts"
      buttonClassName={PILL}
      button={
        <>
          {label}
          <Chevron />
        </>
      }
    >
      <div className="flex min-w-[260px] flex-col">
        <button
          type="button"
          onClick={() => onChange([])}
          disabled={selected.length === 0}
          className="mb-2 self-start text-[12px] font-medium text-ink underline underline-offset-[3px] disabled:text-ink-3 disabled:no-underline"
        >
          All accounts
        </button>
        <ul className="flex max-h-[320px] flex-col overflow-y-auto">
          {all.map((a) => (
            <li key={a.id}>
              <label className="flex h-8 cursor-pointer items-center gap-2.5 rounded-sm px-1 hover:bg-surface-2">
                <input
                  type="checkbox"
                  checked={selected.length === 0 || selected.includes(a.id)}
                  onChange={() => toggle(a.id)}
                  className="accent-accent"
                />
                <span className="truncate text-ink">{a.name}</span>
                {a.mask && <span className="figures text-[12px] text-ink-3">··{a.mask}</span>}
              </label>
            </li>
          ))}
        </ul>
      </div>
    </Popover>
  )
}

type Props = {
  month: string
  onMonth: (m: string) => void
  compare: CashFlowCompare
  onCompare: (c: CashFlowCompare) => void
  accounts: string[]
  onAccounts: (ids: string[]) => void
  data: CashFlow | undefined
}

export function Controls({ month, onMonth, compare, onCompare, accounts, onAccounts, data }: Props) {
  const now = currentMonth()
  const months = Array.from({ length: 13 }, (_, i) => shiftMonth(now, -i))
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Select pill aria-label="Month" value={month} onChange={(e) => onMonth(e.target.value)} className="w-[250px]">
        {months.map((m) => (
          <option key={m} value={m}>
            {m === now ? `This month (${monthLong.format(monthStart(m))})` : monthLong.format(monthStart(m))}
          </option>
        ))}
      </Select>
      <span className="flex items-center gap-2">
        <span aria-hidden className="text-[13px] text-ink-3">
          Compare
        </span>
        <Segmented label="Compare with" value={compare} options={COMPARE_OPTIONS} onChange={onCompare} />
      </span>
      {data && <AccountFilter all={data.accounts} selected={accounts} onChange={onAccounts} />}
      <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[11.5px] whitespace-nowrap text-ink-3">
          <span aria-hidden className="mr-1.5 inline-block size-1.5 rounded-full bg-positive align-[1px]" />
          USD accounts · {monthRange(month)}
        </span>
        <Popover
          label="How we count"
          align="right"
          buttonClassName="cursor-pointer rounded-[2px] text-[12.5px] font-semibold text-ink underline decoration-line-strong underline-offset-[3px]"
          button="How we count"
        >
          <p className="mb-2 font-medium text-ink">How we count</p>
          <ul className="flex list-disc flex-col gap-1.5 pl-4 leading-relaxed">
            <li>Money in is everything that reached your accounts, refunds included (shown as their own source).</li>
            <li>Money out is spending plus debt payments. Card purchases count when you make them, not when you pay the card.</li>
            <li>Kept is money in minus money out. Money you invest or move to savings counts as kept; savings rate is kept ÷ money in.</li>
            <li>Moves between your own accounts and card payments are left out and listed under Not counted. Pending transactions and transfers we couldn’t match still count.</li>
            <li>Calendar months, one currency at a time, never converted or mixed. Averages use complete months only.</li>
          </ul>
        </Popover>
      </div>
    </div>
  )
}
