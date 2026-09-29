import './cashflow.css'

type Props = {
  amount: number
  /** Baseline amount for this category (`categories[].baseline`); drawn as a dark tick. */
  baseline: number | null
  /** Shared scale for every row: the largest amount or baseline among the categories shown. */
  max: number
  highlight?: boolean
  delay?: number
}

export function CategoryBar({ amount, baseline, max, highlight = false, delay = 0 }: Props) {
  const scale = max > 0 ? 100 / max : 0
  return (
    <span className="cf-track" aria-hidden="true">
      <span
        className={highlight ? 'f hl' : 'f'}
        style={{ width: `${Math.min(100, amount * scale)}%`, animationDelay: `${delay}ms` }}
      />
      {baseline !== null && baseline > 0 && <span className="avg" style={{ left: `${Math.min(100, baseline * scale)}%` }} />}
    </span>
  )
}
