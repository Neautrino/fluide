import { Link, useMatchRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useReviewCount } from '../lib/queries'

export const NAV = [
  {
    to: '/',
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
    to: '/transactions',
    label: 'Transactions',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <path d="M3 4h10M3 8h10M3 12h6" />
      </svg>
    ),
  },
  {
    to: '/accounts',
    label: 'Accounts',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M1.5 6 8 2l6.5 4M3 6.5v6M6.3 6.5v6M9.7 6.5v6M13 6.5v6M1.5 14h13" />
      </svg>
    ),
  },
  {
    to: '/cashflow',
    label: 'Cash flow',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M2 14V9M6 14V5M10 14V7M14 14V2" />
      </svg>
    ),
  },
  {
    to: '/review',
    label: 'Review',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 8.5 6 12l7.5-8" />
      </svg>
    ),
  },
  {
    to: '/rules',
    label: 'Rules',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
        <path d="M2 2h6l6 6-6 6-6-6z" />
        <circle cx="5.3" cy="5.3" r="1.2" fill="currentColor" />
      </svg>
    ),
  },
  {
    to: '/assistant',
    label: 'Assistant',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
        <path d="M8 1.8 9.3 6.7 14.2 8 9.3 9.3 8 14.2 6.7 9.3 1.8 8 6.7 6.7z" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
        <path d="M6.9 1.5h2.2l.4 1.9 1.3.6 1.7-1 1.5 1.5-1 1.7.6 1.3 1.9.4v2.2l-1.9.4-.6 1.3 1 1.7-1.5 1.5-1.7-1-1.3.6-.4 1.9H6.9l-.4-1.9-1.3-.6-1.7 1-1.5-1.5 1-1.7-.6-1.3-1.9-.4V6.9l1.9-.4.6-1.3-1-1.7 1.5-1.5 1.7 1 1.3-.6z" />
        <circle cx="8" cy="8" r="2.2" />
      </svg>
    ),
  },
] as const

function Wordmark() {
  return (
    <div className="font-display pl-2 text-[22px] font-extrabold tracking-[-0.02em] text-ink">
      fluide<i className="not-italic text-ink-3">_</i>
    </div>
  )
}

function NavList({ reviewCount, onNavigate }: { reviewCount: number | null; onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col gap-[2px]">
      {NAV.map((item) => (
        <li key={item.to}>
          <Link
            to={item.to}
            onClick={onNavigate}
            activeOptions={{ exact: item.to === '/' }}
            className="flex w-full items-center gap-[10px] rounded-sm border px-[10px] py-[9px] text-left text-[14px] transition-colors"
            activeProps={{ className: 'border-line-strong bg-surface font-semibold text-ink' }}
            inactiveProps={{ className: 'border-transparent font-medium text-ink-2 hover:text-ink' }}
          >
            <span className="h-[17px] w-[17px] flex-none [&>svg]:h-full [&>svg]:w-full">{item.icon}</span>
            {item.label}
            {item.to === '/review' && reviewCount !== null && reviewCount > 0 && (
              <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-surface-inverse px-1.5 text-[11px] font-bold text-ink-inverse">
                {reviewCount}
                <span className="sr-only"> pending</span>
              </span>
            )}
          </Link>
        </li>
      ))}
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

export function Sidebar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const reviewCount = useReviewCount()
  const matchRoute = useMatchRoute()
  const current = NAV.find((item) => matchRoute({ to: item.to, fuzzy: item.to !== '/' }))?.label ?? 'Menu'

  return (
    <>
      <aside className="sticky top-0 hidden h-svh w-[232px] shrink-0 flex-col gap-[26px] border-r border-line bg-surface-2 px-[18px] pb-[22px] pt-[26px] md:flex">
        <Wordmark />
        <nav aria-label="Primary">
          <NavList reviewCount={reviewCount} />
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
            <NavList reviewCount={reviewCount} onNavigate={() => setMenuOpen(false)} />
            <div className="mt-4">
              <ReadOnlyNote />
            </div>
          </nav>
        )}
      </header>
    </>
  )
}
