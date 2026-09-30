import './sankey.css'

type Props = {
  amount: number
  /** Baseline amount for this category (`categories[].baseline`); drawn as a dashed tick. */
  baseline: number | null
  /** Shared scale for every row: the largest amount or baseline among the categories shown. */
  max: number
  highlight?: boolean
}

export function CategoryBar({ amount, baseline, max, highlight = false }: Props) {
  const scale = max > 0 ? 100 / max : 0
  const tick = baseline !== null && baseline > 0 ? `${Math.min(100, baseline * scale)}%` : null
  return (
    <span className="cf-track" aria-hidden="true">
      <span className={highlight ? 'cf-fill cf-hl' : 'cf-fill'} style={{ width: `${Math.min(100, amount * scale)}%` }} />
      {tick && <span className="cf-tick" style={{ left: tick }} />}
      {tick && baseline !== null && baseline < amount && <span className="cf-tick cf-in" style={{ left: tick }} />}
    </span>
  )
}
