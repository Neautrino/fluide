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

/** Tinted square with a line glyph for the account's kind; mortgages and home-equity loans get a house. */
export function AccountIcon({
  kind,
  subtype = null,
  size = 'sm',
}: {
  kind: AccountKind | null
  subtype?: string | null
  size?: 'sm' | 'lg'
}) {
  const style = STYLE[kind === 'cash' || kind === 'credit' || kind === 'loan' || kind === 'investment' ? kind : 'other']
  const glyph = kind === 'loan' && subtype && /mortgage|home/i.test(subtype) ? 'house' : style.glyph
  const box = size === 'lg' ? 'size-11 rounded-[11px]' : 'size-[30px] rounded-lg'
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
