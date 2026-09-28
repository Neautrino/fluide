import { useState } from 'react'
import type { View } from '../lib/app-context'

const NAV: { view: View; label: string }[] = [
  { view: 'overview', label: 'Overview' },
  { view: 'accounts', label: 'Accounts' },
  { view: 'transactions', label: 'Transactions' },
  { view: 'review', label: 'Review' },
  { view: 'rules', label: 'Rules' },
  { view: 'assistant', label: 'Assistant' },
  { view: 'settings', label: 'Settings' },
]

type Props = {
  view: View
  onNavigate: (view: View) => void
  reviewCount: number | null
}

function Wordmark() {
  return (
    <div>
      <p className="font-display text-[30px] leading-none font-[450] tracking-[-0.02em] text-ink">
        Fluide<span className="text-green">.</span>
      </p>
      <p className="eyebrow mt-1.5 text-[10px]">Private ledger</p>
    </div>
  )
}

function NavList({ view, onNavigate, reviewCount }: Props) {
  return (
    <ul className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active = item.view === view
        return (
          <li key={item.view}>
            <button
              type="button"
              onClick={() => onNavigate(item.view)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex h-9 w-full items-center justify-between rounded-[3px] pr-2.5 pl-3.5 text-left text-[14px] transition-colors ${
                active ? 'bg-paper-raised font-medium text-ink' : 'text-ink-2 hover:bg-paper-raised/60 hover:text-ink'
              }`}
            >
              {active && <span aria-hidden className="absolute inset-y-1.5 left-0 w-[2px] bg-green" />}
              {item.label}
              {item.view === 'review' && reviewCount !== null && reviewCount > 0 && (
                <span className="figures min-w-5 rounded-full bg-green px-1.5 text-center text-[11px] leading-5 font-medium text-paper-raised">
                  {reviewCount}
                  <span className="sr-only"> pending</span>
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function ReadOnlyNote() {
  return (
    <div className="border-t border-rule pt-4">
      <p className="flex items-center gap-2 text-[12px] font-medium text-ink-2">
        <svg viewBox="0 0 16 16" className="size-3.5 text-green" aria-hidden>
          <rect x="3" y="7" width="10" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        Read-only · self-hosted
      </p>
      <p className="mt-1 text-[12px] leading-relaxed text-ink-3">Fluide reads your accounts. It can never move money.</p>
    </div>
  )
}

export function Sidebar(props: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const current = NAV.find((n) => n.view === props.view)?.label

  return (
    <>
      <aside className="hidden w-[232px] shrink-0 border-r border-rule bg-paper-sunk/70 md:block">
        <div className="sticky top-0 flex h-svh flex-col justify-between px-5 pt-8 pb-6">
          <div className="flex flex-col gap-10">
            <Wordmark />
            <nav aria-label="Primary">
              <NavList {...props} />
            </nav>
          </div>
          <ReadOnlyNote />
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-rule bg-paper/95 backdrop-blur-[2px] md:hidden">
        <div className="flex h-14 items-center justify-between px-5">
          <p className="font-display text-[24px] leading-none font-[450] tracking-[-0.02em]">
            Fluide<span className="text-green">.</span>
          </p>
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-9 items-center gap-2 rounded-[3px] border border-rule-strong bg-paper-raised px-3 text-[13px] font-medium text-ink"
          >
            {current}
            <svg viewBox="0 0 12 12" className={`size-3 transition-transform ${menuOpen ? 'rotate-180' : ''}`} aria-hidden>
              <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </button>
        </div>
        {menuOpen && (
          <nav id="mobile-nav" aria-label="Primary" className="border-t border-rule bg-paper-sunk px-4 pt-3 pb-4">
            <NavList
              {...props}
              onNavigate={(v) => {
                setMenuOpen(false)
                props.onNavigate(v)
              }}
            />
            <div className="mt-4">
              <ReadOnlyNote />
            </div>
          </nav>
        )}
      </header>
    </>
  )
}
