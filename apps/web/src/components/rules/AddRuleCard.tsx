import { useState } from 'react'
import { errorMessage, sendJson, type Rule } from '../../lib/api'
import type { CategoryCatalogue } from '@repo/ui/categories'
import { Button, CategorySelect, Notice } from '@repo/ui/primitives'
import { CARD, CardHead, checkPattern } from '@repo/ui/rules'

type Props = {
  rules: Rule[] | undefined
  catalogue: CategoryCatalogue | undefined
  onCreated: () => void
}

const LABEL = 'mb-[5px] block text-[11.5px] font-semibold text-ink-2'

export function AddRuleCard({ rules, catalogue, onCreated }: Props) {
  const [pattern, setPattern] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<string | null>(null)
  const check = checkPattern(pattern, rules)

  const submit = async () => {
    setBusy(true)
    setError(null)
    setCreated(null)
    try {
      const { rule } = await sendJson<{ rule: Rule }>('POST', '/api/assistant/rules', { pattern: pattern.trim(), categoryId })
      setCreated(rule.pattern)
      setPattern('')
      setCategoryId('')
      onCreated()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={CARD} aria-labelledby="rules-add-title">
      <CardHead id="rules-add-title" title="Add rule" meta="runs before the model" />
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (check.ready && categoryId && !busy) void submit()
        }}
      >
        <div>
          <label htmlFor="rule-pattern" className={LABEL}>
            Pattern
          </label>
          <input
            id="rule-pattern"
            value={pattern}
            onChange={(e) => {
              setPattern(e.target.value)
              setCreated(null)
            }}
            placeholder="e.g. DMART"
            autoComplete="off"
            spellCheck={false}
            aria-invalid={check.blocker ? true : undefined}
            aria-describedby="rule-pattern-help rule-pattern-notes"
            className="h-[38px] w-full rounded-sm border border-line bg-surface px-3 font-mono text-[13px] text-ink placeholder:text-ink-3 focus-visible:border-line-strong aria-[invalid=true]:border-line-strong"
          />
          <p id="rule-pattern-help" className="mt-[5px] text-[11px] text-ink-3">
            Matches any merchant text that contains this, ignoring case. Only the merchant name is checked.
          </p>
          <div id="rule-pattern-notes" aria-live="polite" className="flex flex-col gap-1">
            {check.blocker && <p className="mt-1 text-[11.5px] leading-[1.4] font-medium text-ink-2">{check.blocker}</p>}
            {check.notes.map((n) => (
              <p key={n} className="mt-1 text-[11.5px] leading-[1.4] text-ink-2">
                {n}
              </p>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="rule-category" className={LABEL}>
            Category
          </label>
          <CategorySelect
            id="rule-category"
            catalogue={catalogue}
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value)
              setCreated(null)
            }}
          />
        </div>
        <Button type="submit" variant="primary" busy={busy} disabled={!check.ready || !categoryId} className="w-full">
          Create rule
        </Button>
        {error && <Notice tone="error">{error}</Notice>}
        {created && <Notice tone="success">Rule “{created}” created. It applies to transactions categorized from now on.</Notice>}
      </form>
    </section>
  )
}
