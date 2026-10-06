import type { ReactNode, Ref } from 'react'

/** The search field in the ledger toolbar. */
export function LedgerSearch({ value, onChange, id = 'tx-search' }: { value: string; onChange: (value: string) => void; id?: string }) {
  return (
    <label className="flex h-[34px] min-w-[170px] max-w-[260px] flex-1 items-center gap-[8px] rounded-[17px] border border-line bg-surface px-[12px] transition-colors focus-within:border-line-strong hover:border-line-strong">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="size-[14px] flex-none text-ink-3">
        <circle cx="7" cy="7" r="4.8" />
        <path d="m10.5 10.5 3.5 3.5" />
      </svg>
      <input
        id={id}
        type="search"
        aria-label="Search merchant or description"
        placeholder="Search merchant or description"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[12.5px] text-ink outline-none placeholder:text-ink-3"
      />
    </label>
  )
}

/**
 * The Transactions page body: the waiting strip, the month card, the Ledger header row, the toolbar and the
 * list card. Everything that talks to the server (sync, categorize, search params, the drawer) is a slot.
 */
export function TransactionsView({
  docked = false,
  waiting,
  monthCard,
  count,
  headingRef,
  actions,
  notices,
  search,
  filter,
  shown,
  children,
  drawer,
}: {
  /** The transaction drawer sits beside the list instead of over it. */
  docked?: boolean
  waiting?: ReactNode
  monthCard?: ReactNode
  /** Rows loaded, for "n transactions · all accounts". */
  count: number
  headingRef?: Ref<HTMLHeadingElement>
  /** Sync / Run categorization. */
  actions?: ReactNode
  notices?: ReactNode
  search: { value: string; onChange: (value: string) => void }
  /** The category filter control. */
  filter?: ReactNode
  /** "12 of 412" at the end of the toolbar; omit while the rows are unknown. */
  shown?: { visible: number; total: number } | null
  /** The list card's contents. */
  children?: ReactNode
  drawer?: ReactNode
}) {
  return (
    <div className={`-mx-[28px] -mb-[30px] mt-[20px] min-h-0 flex-1 border-t border-line ${docked ? 'grid grid-cols-[minmax(0,1fr)_372px]' : 'flex flex-col'}`}>
      <div className="flex min-w-0 flex-col gap-[16px] p-[20px_28px_30px]">
        {waiting}
        {monthCard}

        <div className="flex items-end gap-[12px]">
          <div>
            <h2 ref={headingRef} tabIndex={-1} className="font-display text-[17px] font-bold tracking-[-0.01em] text-ink outline-none">
              Ledger
            </h2>
            <p className="mt-[3px] text-[12px] text-ink-3">{count} transactions · all accounts</p>
          </div>
          <div className="ml-auto flex gap-[8px]">{actions}</div>
        </div>

        {notices}

        <div className="flex flex-wrap items-center gap-[8px]">
          <LedgerSearch value={search.value} onChange={search.onChange} />
          {filter}
          {shown && (
            <span className="ml-auto whitespace-nowrap text-[12px] text-ink-3">
              <span className="font-display text-[15px] font-[800] text-ink">{shown.visible}</span> of {shown.total}
            </span>
          )}
        </div>

        <div data-tx-list className="mt-[16px] overflow-hidden rounded-lg border border-line bg-surface shadow-1">
          {children}
        </div>
      </div>
      {drawer}
    </div>
  )
}

/** The two icon buttons above the ledger; the host supplies the `Button`s' behaviour. */
export function SyncGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-[14px]">
      <path d="M13.5 6.5A5.6 5.6 0 0 0 3.2 4.6M2.5 9.5a5.6 5.6 0 0 0 10.3 1.9" />
      <path d="M3 1.8v3h3M13 14.2v-3h-3" />
    </svg>
  )
}

export function CategorizeGlyph() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-[14px]">
      <path d="M14 8.5L7.5 15l-6-6V2h7l6.5 6.5z" />
      <circle cx="5" cy="5.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}
