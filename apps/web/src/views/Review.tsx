import { useState } from 'react'
import { RecategorizeControl } from '../components/RecategorizeControl'
import { Button } from '../components/ui/Button'
import { Empty, ErrorState, Loading, Notice } from '../components/ui/States'
import { Confidence, Money, PageHeader } from '../components/ui/Typography'
import { errorMessage, getJson, sendJson, type ReviewItem } from '../lib/api'
import { useApp } from '../lib/app-context'
import { useCategories } from '../lib/categories'
import { formatLedgerDate, sourceLabel } from '../lib/format'
import { useResource } from '../lib/useResource'

type Outcome = { id: string; tone: 'success' | 'error'; text: string; proposedRule: boolean }

export function Review() {
  const { version, invalidate, navigate } = useApp()
  const categories = useCategories()
  const queue = useResource(
    (signal) => getJson<{ items: ReviewItem[] }>('/api/assistant/review-queue', signal).then((r) => r.items),
    version,
  )
  const [actingOn, setActingOn] = useState<string | null>(null)
  const [outcomes, setOutcomes] = useState<Outcome[]>([])

  const record = (o: Outcome) => setOutcomes((prev) => [o, ...prev.filter((p) => p.id !== o.id)].slice(0, 5))

  const resolve = async (item: ReviewItem, decision: 'approve' | 'reject') => {
    setActingOn(item.id)
    const who = item.posting?.counterpartyRaw || item.posting?.description || 'Item'
    try {
      if (decision === 'approve') {
        const res = await sendJson<{ approved: string; proposedRuleId: string | null }>(
          'POST',
          `/api/assistant/review-queue/${item.id}/approve`,
        )
        record({ id: item.id, tone: 'success', text: `${who}: suggestion approved.`, proposedRule: !!res.proposedRuleId })
      } else {
        await sendJson('POST', `/api/assistant/review-queue/${item.id}/reject`)
        record({ id: item.id, tone: 'success', text: `${who}: suggestion rejected — it stays uncategorized.`, proposedRule: false })
      }
      invalidate()
    } catch (e) {
      record({ id: item.id, tone: 'error', text: `${who}: ${errorMessage(e)}`, proposedRule: false })
      queue.reload()
    } finally {
      setActingOn(null)
    }
  }

  const items = queue.data

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Categorization"
        title="Review"
        lede="Suggestions the confidence gate wasn't sure enough to apply on its own. Nothing here touches the ledger until you decide."
      />

      {outcomes.length > 0 && (
        <div className="flex flex-col gap-2" aria-live="polite">
          {outcomes.map((o) => (
            <Notice key={o.id} tone={o.tone}>
              {o.text}
              {o.proposedRule && (
                <>
                  {' '}
                  Rule proposed —{' '}
                  <button type="button" className="font-medium underline underline-offset-2" onClick={() => navigate('rules')}>
                    review it under Rules
                  </button>
                  .
                </>
              )}
            </Notice>
          ))}
        </div>
      )}

      {queue.error ? (
        <ErrorState title="Couldn't load the review queue" message={queue.error} onRetry={queue.reload} />
      ) : !items ? (
        <Loading label="Loading review queue" rows={4} />
      ) : items.length === 0 ? (
        <Empty title="Nothing to review.">
          Every suggestion either applied automatically or has been decided. Run categorization from Transactions to
          process new postings.
        </Empty>
      ) : (
        <>
          <p className="figures -mb-4 text-[13px] text-ink-3">
            {items.length} pending {items.length === 1 ? 'item' : 'items'}
          </p>
          <ul className="border-t border-ink">
            {items.map((item) => {
              const suggestion = item.suggestedCategoryId ? categories.data?.byId[item.suggestedCategoryId] : undefined
              const busy = actingOn === item.id
              const merchant = item.posting?.counterpartyRaw || item.posting?.description || 'Unknown merchant'
              return (
                <li key={item.id} className="grid grid-cols-1 gap-5 border-b border-rule py-6 md:grid-cols-12 md:gap-8">
                  <div className="md:col-span-4">
                    <p className="text-[17px] leading-snug text-ink">{merchant}</p>
                    {item.posting && (
                      <p className="mt-1 flex items-baseline gap-3 text-[13px] text-ink-3">
                        <Money
                          amount={item.posting.amount}
                          currency={item.posting.currency}
                          tone="flow"
                          className="font-display text-[20px] text-ink"
                        />
                        <span className="figures">{formatLedgerDate(item.posting.date)}</span>
                      </p>
                    )}
                    {item.posting?.description && item.posting.description !== merchant && (
                      <p className="mt-1 truncate text-[12px] text-ink-3">{item.posting.description}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 md:col-span-5">
                    {item.suggestedCategoryId ? (
                      <>
                        <p className="text-[13px] text-ink-3">
                          Suggested by {sourceLabel(item.source)}
                        </p>
                        <p className="font-display text-[22px] leading-tight text-ink">
                          {suggestion?.label ?? (categories.error ? 'Unknown category' : '…')}
                        </p>
                        <Confidence band={item.confidenceBand} value={item.confidence} />
                      </>
                    ) : (
                      <>
                        <p className="font-display text-[20px] leading-tight text-ink">No suggestion</p>
                        <p className="text-[13px] text-ink-3">
                          {sourceLabel(item.source)}'s confidence was below the threshold for suggesting anything.
                          Choose the category yourself.
                        </p>
                        <Confidence band={item.confidenceBand} value={item.confidence} />
                      </>
                    )}
                    {item.reason && (
                      <p className="border-l border-rule-strong pl-3 text-[13px] leading-relaxed text-ink-2">{item.reason}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 md:col-span-3 md:items-end">
                    {item.suggestedCategoryId ? (
                      <div className="flex gap-2">
                        <Button variant="primary" busy={busy} onClick={() => resolve(item, 'approve')}>
                          Approve
                        </Button>
                        <Button disabled={busy} onClick={() => resolve(item, 'reject')}>
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <div className="flex w-full flex-col gap-2">
                        <RecategorizeControl
                          postingId={item.postingId}
                          submitLabel="Apply category"
                          layout="stacked"
                          onDone={(res) =>
                            record({
                              id: item.id,
                              tone: 'success',
                              text: `${merchant}: category applied.`,
                              proposedRule: !!res.proposedRuleId,
                            })
                          }
                        />
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => resolve(item, 'reject')} className="self-start md:self-end">
                          Dismiss without a category
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
