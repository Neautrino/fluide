import { useState } from 'react'
import { CategorySelect } from '../components/CategorySelect'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { Segmented } from '../components/ui/Segmented'
import { Empty, ErrorState, Loading, Notice } from '../components/ui/States'
import { Confidence, PageHeader, SectionTitle } from '../components/ui/Typography'
import { errorMessage, getJson, sendJson, type Rule, type RuleStatus } from '../lib/api'
import { useApp } from '../lib/app-context'
import { useCategories, type CategoryCatalogue } from '../lib/categories'
import { bandFor, formatLedgerDate, toNumber } from '../lib/format'
import { useResource } from '../lib/useResource'

/** SOURCE OF TRUTH: categorization rules management.
 * WHAT: GET /api/categorization-rules split into Proposed / Active /
 * Rejected; activate or reject proposed rules
 * (POST /api/categorization-rules/:id/activate|reject); add your own active
 * rule (POST /api/categorization-rules).
 * WHY: rules learned from approvals and recategorizations are only
 * *proposed* — they do nothing until a person activates them, so the
 * system never silently teaches itself.
 * WHERE: rendering + those three actions; matching happens server-side.
 */

const STATUS_COPY: Record<RuleStatus, { empty: string; note: string }> = {
  proposed: {
    empty: 'Fluide proposes one when you approve a suggestion or recategorize a transaction.',
    note: 'Proposed rules do nothing until you activate them. Activate one to apply its category automatically to future matching transactions.',
  },
  active: {
    empty: 'Activate a proposed rule or add your own below.',
    note: 'Active rules run first during categorization, before the Jev model is consulted.',
  },
  rejected: {
    empty: 'Rules you reject are listed here.',
    note: 'Rejected rules are kept so Fluide does not propose them again.',
  },
}

export function Rules() {
  const { version, invalidate } = useApp()
  const categories = useCategories()
  const rules = useResource(
    (signal) => getJson<{ rules: Rule[] }>('/api/assistant/rules', signal).then((r) => r.rules),
    version,
  )
  const [tab, setTab] = useState<RuleStatus>('proposed')
  const [actingOn, setActingOn] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const decide = async (rule: Rule, decision: 'activate' | 'reject') => {
    setActingOn(rule.id)
    setActionError(null)
    try {
      await sendJson('POST', `/api/assistant/rules/${rule.id}/${decision}`)
      invalidate()
    } catch (e) {
      setActionError(`“${rule.pattern}”: ${errorMessage(e)}`)
    } finally {
      setActingOn(null)
    }
  }

  const count = (s: RuleStatus) => rules.data?.filter((r) => r.status === s).length ?? 0
  const shown = (rules.data ?? []).filter((r) => r.status === tab)

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Categorization"
        title="Rules"
        lede="Patterns that categorize matching transactions before the model is asked."
      />

      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Segmented
            label="Rule status"
            value={tab}
            onChange={setTab}
            options={(['proposed', 'active', 'rejected'] as const).map((s) => ({
              value: s,
              label: (
                <>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                  {rules.data && <span className="figures ml-1.5 opacity-70">{count(s)}</span>}
                </>
              ),
            }))}
          />
        </div>
        <p className="max-w-2xl text-[14px] leading-relaxed text-ink-2">{STATUS_COPY[tab].note}</p>
        {actionError && <Notice tone="error">{actionError}</Notice>}

        {rules.error ? (
          <ErrorState title="Couldn't load rules" message={rules.error} onRetry={rules.reload} />
        ) : !rules.data ? (
          <Loading label="Loading rules" rows={4} />
        ) : shown.length === 0 ? (
          <Empty title={`No ${tab} rules`}>{STATUS_COPY[tab].empty}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[14px]">
              <thead>
                <tr className="border-b border-ink text-left">
                  <th scope="col" className="eyebrow py-2 pr-4 font-[550]">Pattern</th>
                  <th scope="col" className="eyebrow py-2 pr-4 font-[550]">Category</th>
                  <th scope="col" className="eyebrow py-2 pr-4 font-[550]">Origin</th>
                  <th scope="col" className="eyebrow py-2 pr-4 text-right font-[550]">Matched</th>
                  <th scope="col" className="eyebrow py-2 pr-4 font-[550]">Learned confidence</th>
                  {tab === 'proposed' && (
                    <th scope="col" className="py-2 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-b border-rule align-middle">
                    <td className="py-3 pr-4">
                      <code className="rounded-[2px] bg-paper-sunk px-1.5 py-0.5 font-mono text-[13px] text-ink">{r.pattern}</code>
                    </td>
                    <td className="py-3 pr-4 text-ink">{categories.data?.byId[r.categoryId]?.label ?? '—'}</td>
                    <td className="py-3 pr-4 text-ink-2">
                      {r.isUserCustom ? 'Your rule' : 'Learned'}
                      <span className="block text-[12px] text-ink-3">{formatLedgerDate(r.createdAt)}</span>
                    </td>
                    <td className="figures py-3 pr-4 text-right text-ink">{r.timesMatched}</td>
                    <td className="py-3 pr-4">
                      {r.confidenceLearned === null ? (
                        <span className="text-ink-3">—</span>
                      ) : (
                        <Confidence band={bandFor(toNumber(r.confidenceLearned))} value={r.confidenceLearned} />
                      )}
                    </td>
                    {tab === 'proposed' && (
                      <td className="py-3 text-right">
                        <div className="inline-flex gap-2">
                          <Button size="sm" variant="primary" busy={actingOn === r.id} onClick={() => decide(r, 'activate')}>
                            Activate
                          </Button>
                          <Button size="sm" disabled={actingOn === r.id} onClick={() => decide(r, 'reject')}>
                            Reject
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AddRule onAdded={invalidate} catalogue={categories.data} />
    </div>
  )
}

function AddRule({ onAdded, catalogue }: { onAdded: () => void; catalogue: CategoryCatalogue | undefined }) {
  const [pattern, setPattern] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [added, setAdded] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    setAdded(null)
    try {
      const { rule } = await sendJson<{ rule: Rule }>('POST', '/api/assistant/rules', {
        pattern: pattern.trim(),
        categoryId,
      })
      setAdded(rule.pattern)
      setPattern('')
      setCategoryId('')
      onAdded()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="max-w-3xl">
      <SectionTitle>Add your own rule</SectionTitle>
      <p className="mb-5 text-[14px] leading-relaxed text-ink-2">
        Your rules are active immediately and apply to transactions categorized from now on.
      </p>
      <form
        className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start"
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <Field id="rule-pattern" label="Pattern" help="Text matched against the merchant name, e.g. “Uber”.">
          <Input
            id="rule-pattern"
            aria-describedby="rule-pattern-help"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="Merchant text"
            required
          />
        </Field>
        <Field id="rule-category" label="Category">
          <CategorySelect
            id="rule-category"
            catalogue={catalogue}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          />
        </Field>
        <Button type="submit" variant="primary" busy={busy} disabled={!pattern.trim() || !categoryId} className="sm:mt-[26px]">
          Add rule
        </Button>
      </form>
      <div className="mt-4">
        {error && <Notice tone="error">{error}</Notice>}
        {added && <Notice tone="success">Rule “{added}” added and active.</Notice>}
      </div>
    </section>
  )
}
