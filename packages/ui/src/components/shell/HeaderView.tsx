import type { ReactNode, Ref } from 'react'

/** The eyebrow a view shows after the date; Review's is a live count, so it is not in here. */
export const HEADER_SUBTITLE: Record<string, string> = {
  '/transactions': 'every account, one list',
  '/accounts': 'what you have and owe',
  '/cashflow': 'money in and out',
  '/rules': 'categorization',
  '/settings': 'connections and categorization',
  '/assistant': 'answers from your ledger',
}

export function getGreeting(date: Date) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function getDaysLeft(date: Date) {
  const daysLeft = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate() - date.getDate()
  const monthName = date.toLocaleString('default', { month: 'long' })
  if (daysLeft === 0) return `Last day of ${monthName}`
  if (daysLeft === 1) return `1 day left in ${monthName}`
  return `${daysLeft} days left in ${monthName}`
}

/** Title block on the left, whatever the host wires up (ask box, buttons, notifications) on the right. */
export function HeaderView({ topLine, title, children }: { topLine: string; title: string; children?: ReactNode }) {
  return (
    <header className="flex items-center gap-4 pt-[26px]">
      <div className="max-md:min-w-0">
        <small className="mb-[3px] block text-[13px] text-ink-2">{topLine}</small>
        <h1 className="truncate font-display text-[23px] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">{title}</h1>
      </div>
      <div className="ml-auto flex items-center gap-4 md:min-w-0">{children}</div>
    </header>
  )
}

/** The `/`-focusable ask field in the header. */
export function HeaderAskBox({
  value,
  onChange,
  onSubmit,
  inputRef,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  inputRef?: Ref<HTMLInputElement>
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="hidden relative md:flex w-[360px] min-w-0 xl:w-[420px] items-center gap-[9px] h-[40px] rounded-[20px] border border-line bg-surface px-1.5 pl-[14px]"
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4 flex-none text-ink-2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M8 1.8 9.3 6.7 14.2 8 9.3 9.3 8 14.2 6.7 9.3 1.8 8 6.7 6.7z" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        placeholder="Ask about your money…"
        aria-label="Ask about your money"
        className="flex-1 bg-transparent border-0 outline-0 text-[13px] min-w-0 placeholder:text-ink-3 text-ink"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <kbd className="rounded-[6px] border border-line px-1.5 py-1 font-mono text-[10.5px] font-semibold text-ink-3">/</kbd>
    </form>
  )
}

/** One of the round header buttons (sync, hide amounts, theme). */
export function HeaderButton({
  title,
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  title: string
  label: string
  pressed?: boolean
  disabled?: boolean
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="grid h-[40px] w-[40px] flex-none place-items-center rounded-full border border-line-strong bg-surface hover:bg-surface-2 transition-colors disabled:opacity-50"
      title={title}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function SyncIcon({ spinning = false }: { spinning?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={`h-[17px] w-[17px] text-ink ${spinning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 6.5A5.6 5.6 0 0 0 3.2 4.6M2.5 9.5a5.6 5.6 0 0 0 10.3 1.9" />
      <path d="M3 1.8v3h3M13 14.2v-3h-3" />
    </svg>
  )
}

export function HideAmountsIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="h-[17px] w-[17px] text-ink" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      {hidden ? (
        <>
          <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
          <path d="M14 2L2 14" />
        </>
      ) : (
        <>
          <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
          <circle cx="8" cy="8" r="2" />
        </>
      )}
    </svg>
  )
}

export function ThemeIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-[17px] w-[17px] text-ink" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 2a6 6 0 0 0 0 12z" fill="currentColor" />
    </svg>
  )
}
