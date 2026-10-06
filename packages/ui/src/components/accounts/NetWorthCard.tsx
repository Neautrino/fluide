import type { CSSProperties } from 'react'
import { formatMoney } from '../../lib/format'
import { AMOUNT_HIDDEN, useAmountsHidden } from '../cashflow/amounts'
import { CARD, CARD_TITLE, type CurrencyTotals } from './model'
import { Amt } from './shared'

const SEGMENTS = [
  { key: 'cash', label: 'Cash', bg: 'bg-chart-1' },
  { key: 'investments', label: 'Investments', bg: 'bg-chart-2' },
  { key: 'otherAssets', label: 'Other', bg: 'bg-chart-5' },
  { key: 'cards', label: 'Cards', bg: 'bg-chart-3' },
  { key: 'loans', label: 'Loans', bg: 'bg-chart-4' },
] as const

function SplitBar({ parts, widthPct, label }: { parts: { key: string; bg: string; value: number }[]; widthPct: number; label: string }) {
  const shown = parts.filter((p) => p.value > 0)
  const sum = shown.reduce((s, p) => s + p.value, 0)
  return (
    <div role="img" aria-label={label} className="flex h-5 overflow-hidden rounded-[6px] border border-line-strong" style={{ width: `${widthPct}%` }}>
      {shown.map((p) => (
          <i key={p.key} className={`block h-full border-line-strong not-first:border-l ${p.bg}`} style={{ width: `${(p.value / sum) * 100}%` }} />
        ))}
    </div>
  )
}

export function NetWorthCard({ totals: t, uncounted, stamp }: { totals: CurrencyTotals; uncounted: number; stamp: string | null }) {
  const hidden = useAmountsHidden()
  const scale = Math.max(t.assets, t.owed)
  const assetsPct = scale > 0 ? (Math.max(0, t.assets) / scale) * 100 : 0
  const owedPct = scale > 0 ? (Math.max(0, t.owed) / scale) * 100 : 0
  const ratio = t.assets > 0 && t.owed > 0 ? (t.owed / t.assets) * 100 : null
  const ratioLabel = ratio === null ? null : `owed = ${ratio >= 100 ? Math.round(ratio) : ratio.toFixed(1)}% of assets`
  const inCredit = t.owed < 0
  const shorterIsAssets = t.assets < t.owed
  const present = {
    cash: t.kinds.has('cash'),
    investments: t.kinds.has('investment'),
    otherAssets: t.otherAssets !== 0,
    cards: t.kinds.has('credit'),
    loans: t.kinds.has('loan'),
  }
  const shown = SEGMENTS.filter((s) => present[s.key])
  const money = (n: number) => (hidden ? AMOUNT_HIDDEN : formatMoney(n, t.currency))

  const gap = (
    <div aria-hidden className="absolute top-2.5 right-0 border-t border-dashed border-ink-3" style={{ left: 'calc(var(--w) + 6px)' }} />
  )
  const gapLabel = (
    <span className="absolute top-0 bg-surface px-1.5 text-[11px] whitespace-nowrap text-ink-2" style={{ left: 'calc(var(--w) + 16px)' }}>
      {ratioLabel}
    </span>
  )

  return (
    <section aria-label="Net worth" className={`${CARD} px-6 pt-5 pb-[18px]`}>
      <div className="grid gap-x-10 gap-y-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
            <h2 className={CARD_TITLE}>
              Net worth <span className="font-semibold text-ink-3">· {t.currency} · yours only</span>
            </h2>
            {stamp && (
              <span className="text-[11.5px] whitespace-nowrap text-ink-3">
                <span aria-hidden className="mr-1.5 inline-block size-1.5 rounded-full bg-positive align-[1px]" />
                {stamp}
              </span>
            )}
          </div>
          <p className="mt-3 mb-2.5 font-display text-[46px] leading-none font-extrabold tracking-[-0.03em] text-ink min-[1360px]:text-[56px]">
            <Amt value={t.net} currency={t.currency} />
          </p>
          <p className="figures text-[13px] text-ink-2">
            Assets <Amt value={t.assets} currency={t.currency} /> · {inCredit ? 'In credit' : 'Owed'} <Amt value={Math.abs(t.owed)} currency={t.currency} />
          </p>
        </div>

        <div className="min-w-0 self-center">
          <div className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-[9px] text-[12px]">
            <span className="font-semibold text-ink-2">Assets</span>
            <div className="relative h-5" style={{ '--w': `${assetsPct}%` } as CSSProperties}>
              <SplitBar
                label={`Assets ${money(t.assets)}: cash ${money(t.cash)}, investments ${money(t.investments)}, other ${money(t.otherAssets)}`}
                widthPct={assetsPct}
                parts={[
                  { key: 'cash', bg: 'bg-chart-1', value: t.cash },
                  { key: 'investments', bg: 'bg-chart-2', value: t.investments },
                  { key: 'otherAssets', bg: 'bg-chart-5', value: t.otherAssets },
                ]}
              />
              {shorterIsAssets && ratioLabel && (
                <>
                  {gap}
                  {gapLabel}
                </>
              )}
            </div>
            <span className="text-right text-[13px] font-bold">
              <Amt value={t.assets} currency={t.currency} />
            </span>

            <span className="font-semibold text-ink-2">{inCredit ? 'Credit' : 'Owed'}</span>
            <div className="relative h-5" style={{ '--w': `${owedPct}%` } as CSSProperties}>
              <SplitBar
                label={inCredit ? `In credit ${money(-t.owed)}` : `Owed ${money(t.owed)}: loans ${money(t.loans)}, cards ${money(t.cards)}`}
                widthPct={owedPct}
                parts={[
                  { key: 'loans', bg: 'bg-chart-4', value: t.loans },
                  { key: 'cards', bg: 'bg-chart-3', value: t.cards },
                ]}
              />
              {!shorterIsAssets && ratioLabel && (
                <>
                  {gap}
                  {gapLabel}
                </>
              )}
            </div>
            <span className="text-right text-[13px] font-bold">
              <Amt value={-t.owed} currency={t.currency} />
            </span>
          </div>

          <ul className="mt-3.5 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-ink-2">
            {shown.map((s) => (
              <li key={s.key} className="flex flex-col gap-0.5">
                <span className="inline-flex items-center gap-1.5">
                  <i aria-hidden className={`inline-block size-2.5 shrink-0 rounded-[3px] border border-line-strong ${s.bg}`} />
                  {s.label}
                </span>
                <b className="pl-4 text-[12.5px] font-bold text-ink">
                  <Amt value={s.key === 'cards' || s.key === 'loans' ? -t[s.key] : t[s.key]} currency={t.currency} />
                  {(s.key === 'cards' || s.key === 'loans') && t[s.key] < 0 && <span className="ml-1 font-medium text-ink-3">in credit</span>}
                </b>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {uncounted > 0 && (
        <p className="mt-3.5 flex items-start gap-2 border-t border-dashed border-line pt-3 text-[12px] leading-[1.45] text-ink-3">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" aria-hidden className="mt-px size-3.5 shrink-0">
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 7v4.2M8 4.8v.1" />
          </svg>
          <span>
            <b className="font-semibold text-ink-2">
              {uncounted} account{uncounted === 1 ? '' : 's'} not counted
            </b>{' '}
            (left out of net worth).
          </span>
        </p>
      )}
    </section>
  )
}
