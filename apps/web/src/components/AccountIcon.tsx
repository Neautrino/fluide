import type { ReactNode } from 'react'
import type { AccountKind } from '../lib/api'

type Glyph = 'bank' | 'card' | 'house' | 'doc' | 'trend' | 'circle'

const PATHS: Record<Glyph, ReactNode> = {
  bank: (
    <>
      <path d="M3 21h18" />
      <path d="M6 17v-6" />
      <path d="M10 17v-6" />
      <path d="M14 17v-6" />
      <path d="M18 17v-6" />
      <path d="M12 3 3.5 8h17z" />
    </>
  ),
  card: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <path d="M6 15h4" />
    </>
  ),
  house: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9v12h14V9" />
      <path d="M10 21v-6h4v6" />
    </>
  ),
  doc: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h6" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
    </>
  ),
  trend: (
    <>
      <path d="M22 7 13.5 15.5l-5-5L2 17" />
      <path d="M16 7h6v6" />
    </>
  ),
  circle: <circle cx="12" cy="12" r="8" />,
}

const STYLE = {
  cash: { tint: 'bg-positive-wash text-positive', glyph: 'bank' },
  credit: { tint: 'bg-surface-2 text-ink-2', glyph: 'card' },
  loan: { tint: 'bg-warning-wash text-warning', glyph: 'doc' },
  investment: { tint: 'bg-positive-wash/55 text-positive', glyph: 'trend' },
  other: { tint: 'bg-surface-2 text-ink-3', glyph: 'circle' },
} as const satisfies Record<string, { tint: string; glyph: Glyph }>

const MARK_TILES = ['bg-tile-1', 'bg-tile-2', 'bg-tile-3', 'bg-tile-4']

function initials(label: string): string {
  const words = label.replace(/\([^)]*\)/g, '').split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '').slice(0, 2)
  return letters.toUpperCase()
}

/** Tinted square with a line glyph for the account's kind; mortgages and home-equity loans get a house. */
export function AccountIcon({
  kind,
  subtype = null,
  size = 'sm',
  label = null,
}: {
  kind: AccountKind | null
  subtype?: string | null
  size?: 'sm' | 'lg'
  /** The small mark shows these initials (the institution) on a tile colour instead of a kind glyph. */
  label?: string | null
}) {
  if (size === 'sm' && label) {
    const tile = MARK_TILES[[...label].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % MARK_TILES.length]
    return (
      <span
        aria-hidden
        className={`grid size-[34px] shrink-0 place-items-center rounded-full border border-line-strong font-display text-[10.5px] font-extrabold tracking-[0.02em] text-tile-ink ${tile}`}
      >
        {initials(label)}
      </span>
    )
  }
  const style = STYLE[kind === 'cash' || kind === 'credit' || kind === 'loan' || kind === 'investment' ? kind : 'other']
  const glyph = kind === 'loan' && subtype && /mortgage|home/i.test(subtype) ? 'house' : style.glyph
  const box = size === 'lg' ? 'size-11 rounded-[11px]' : 'size-[34px] rounded-full'
  const icon = size === 'lg' ? 'size-[22px]' : 'size-4'
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center ${box} ${style.tint}`}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={icon}
      >
        {PATHS[glyph]}
      </svg>
    </span>
  )
}
