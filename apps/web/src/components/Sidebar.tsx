import { useState } from 'react'
import type { View } from '../lib/app-context'

export const NAV: {
  view: View
  label: string
  icon: React.ReactNode
}[] = [
  {
    view: 'overview',
    label: 'Overview',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" />
        <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" />
        <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" />
        <rect x="9" y="9" width="5.5" height="5.5" rx="1.2" />
      </svg>
    ),
  },
  {
    view: 'transactions',
    label: 'Transactions',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M3 4h10M3 8h10M3 12h6" />
      </svg>
    ),
  },
  {
    view: 'accounts',
    label: 'Accounts',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M1.5 6 8 2l6.5 4M3 6.5v6M6.3 6.5v6M9.7 6.5v6M13 6.5v6M1.5 14h13" />
      </svg>
    ),
  },
  {
    view: 'cashflow',
    label: 'Cash flow',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M2 14V9M6 14V5M10 14V7M14 14V2" />
      </svg>
    ),
  },
  {
    view: 'review',
    label: 'Review',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 8.5 6 12l7.5-8" />
      </svg>
    ),
  },
  {
    view: 'rules',
    label: 'Rules',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
        <path d="M2 2h6l6 6-6 6-6-6z" />
        <circle cx="5.3" cy="5.3" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
  {
    view: 'assistant',
    label: 'Assistant',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
        <path d="M8 1.8 9.3 6.7 14.2 8 9.3 9.3 8 14.2 6.7 9.3 1.8 8 6.7 6.7z" />
      </svg>
    ),
  },
  {
    view: 'settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="8" cy="8" r="2.3" />
        <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
      </svg>
    ),
  },
]

type Props = {
  view: View
  onNavigate: (view: View) => void
  reviewCount: number | null
}

function Wordmark() {
  return (
    <div className="font-display pl-2 text-[22px] font-extrabold tracking-[-0.02em] text-ink">
      fluide<i className="not-italic text-ink-3">_</i>
    </div>
  )
}

function NavList({ view, onNavigate, reviewCount }: Props) {
  return (
    <ul className="flex flex-col gap-[2px]">
      {NAV.map((item) => {
        const active = item.view === view
        return (
          <li key={item.view}>
            <button
              type="button"
              onClick={() => onNavigate(item.view)}
              aria-current={active ? 'page' : undefined}
              className={`flex w-full items-center gap-[10px] rounded-sm border px-[10px] py-[9px] text-left text-[14px] transition-colors ${
                active ? 'border-line-strong bg-surface font-semibold text-ink' : 'border-transparent font-medium text-ink-2 hover:text-ink'
              }`}
            >
              <span className="h-[17px] w-[17px] flex-none [&>svg]:h-full [&>svg]:w-full">{item.icon}</span>
              {item.label}
              {item.view === 'review' && reviewCount !== null && reviewCount > 0 && (
                <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-surface-inverse px-1.5 text-[11px] font-bold text-ink-inverse">
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
    <div className="mt-auto pl-2.5 text-[11.5px] text-ink-3">
      Read-only · self-hosted
    </div>
  )
}

export function Sidebar(props: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const current = NAV.find((n) => n.view === props.view)?.label

  return (
    <>
      <aside className="sticky top-0 hidden h-svh w-[232px] shrink-0 flex-col gap-[26px] border-r border-line bg-surface-2 px-[18px] pb-[22px] pt-[26px] md:flex">
        <Wordmark />
        <nav aria-label="Primary">
          <NavList {...props} />
        </nav>
        <ReadOnlyNote />
      </aside>

      <header className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur-[2px] md:hidden">
        <div className="flex h-14 items-center justify-between px-5">
          <Wordmark />
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-9 items-center gap-2 rounded-sm border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink"
          >
            {current}
            <svg viewBox="0 0 12 12" className={`size-3 transition-transform ${menuOpen ? 'rotate-180' : ''}`} aria-hidden>
              <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </button>
        </div>
        {menuOpen && (
          <nav id="mobile-nav" aria-label="Primary" className="border-t border-line bg-surface-2 px-4 pb-4 pt-3">
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
