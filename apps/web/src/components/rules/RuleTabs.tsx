import type { KeyboardEvent } from 'react'
import type { RuleStatus } from '../../lib/api'

const TABS: { id: RuleStatus; label: string }[] = [
  { id: 'proposed', label: 'Proposed' },
  { id: 'active', label: 'Active' },
  { id: 'rejected', label: 'Rejected' },
]

export const PANEL_ID = 'rules-panel'

type Props = {
  value: RuleStatus
  counts: Record<RuleStatus, number> | null
  onChange: (tab: RuleStatus) => void
}

export function RuleTabs({ value, counts, onChange }: Props) {
  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = TABS.findIndex((t) => t.id === value)
    const to =
      e.key === 'ArrowRight' ? (i + 1) % TABS.length
      : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? TABS.length - 1
      : -1
    if (to < 0) return
    e.preventDefault()
    onChange(TABS[to].id)
    e.currentTarget.querySelector<HTMLElement>(`#rules-tab-${TABS[to].id}`)?.focus()
  }

  return (
    <div role="tablist" aria-label="Rule status" onKeyDown={move} className="inline-flex rounded-full border border-line bg-surface-2 p-[3px]">
      {TABS.map((t) => {
        const on = t.id === value
        return (
          <button
            key={t.id}
            id={`rules-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            aria-controls={PANEL_ID}
            onClick={() => onChange(t.id)}
            className={`h-7 rounded-full px-[13px] text-[12px] font-semibold transition-colors ${
              on ? 'bg-surface text-ink shadow-[0_0_0_1px_var(--line-strong)]' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {t.label}
            {counts && <span className="figures ml-0.5 font-medium opacity-70"> ({counts[t.id]})</span>}
          </button>
        )
      })}
    </div>
  )
}
