import { useId, useState } from 'react'
import { errorMessage, sendJson } from '../lib/api'
import { useApp } from '../lib/app-context'
import { useCategories } from '../lib/categories'
import { CategorySelect } from './CategorySelect'
import { Button } from './ui/Button'
import { Notice } from './ui/States'

type Result = { postingId: string; categoryId: string; ruleId: string | null; alsoFiled: number }

type Props = {
  postingId: string
  vendor: string
  currentCategoryId?: string | null
  submitLabel?: string
  /** 'stacked' keeps select and button on separate lines for narrow columns. */
  layout?: 'inline' | 'stacked'
  onDone?: (result: Result) => void
}

export function RecategorizeControl({ postingId, vendor, currentCategoryId = null, submitLabel = 'Recategorize', layout = 'inline', onDone }: Props) {
  const { navigate, invalidate } = useApp()
  const categories = useCategories()
  const id = useId()
  const [choice, setChoice] = useState(currentCategoryId ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const submit = async () => {
    if (!choice) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const res = await sendJson<Result>('POST', `/api/ledger/postings/${postingId}/category`, { categoryId: choice })
      setResult(res)
      invalidate()
      onDone?.(res)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const unchanged = choice === (currentCategoryId ?? '')

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <label htmlFor={id} className="sr-only">
        Category
      </label>
      <div className={`flex flex-col gap-2 ${layout === 'inline' ? 'sm:flex-row' : ''}`}>
        <CategorySelect
          id={id}
          className="flex-1"
          catalogue={categories.data}
          value={choice}
          onChange={(e) => {
            setChoice(e.target.value)
            setResult(null)
          }}
        />
        <Button type="submit" variant="primary" busy={busy} disabled={!choice || unchanged}>
          {busy ? 'Saving…' : submitLabel}
        </Button>
      </div>
      {categories.error && <Notice tone="error">Categories unavailable: {categories.error}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {result && (
        <Notice tone="success">
          Filed under {categories.data?.byId[result.categoryId]?.label ?? 'the chosen category'}
          {result.alsoFiled > 0 && ` and ${result.alsoFiled} more from ${vendor}`}.
          {result.ruleId && (
            <>
              {' '}
              Rule saved —{' '}
              <button type="button" className="font-medium underline underline-offset-2" onClick={() => navigate('rules')}>
                see Rules
              </button>
              .
            </>
          )}
        </Notice>
      )}
    </form>
  )
}
