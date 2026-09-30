import { useEffect, useRef, useState } from 'react'
import { AfterDecide } from '../components/review/AfterDecide'
import { AtStake } from '../components/review/AtStake'
import { ConfidenceSplit } from '../components/review/ConfidenceSplit'
import { useConnections, usePossibleTransfers, usePostingAccounts, useRulePatterns } from '../components/review/data'
import { Hero } from '../components/review/Hero'
import { QueueCard } from '../components/review/QueueCard'
import { atStakeByCurrency, itemAmount, itemName, tilesFor } from '../components/review/helpers'
import { TransferCard } from '../components/review/TransferCard'
import { TrustLine } from '../components/review/TrustLine'
import { Segmented } from '../components/ui/Segmented'
import { Button } from '../components/ui/Button'
import { ErrorState, Loading, Notice } from '../components/ui/States'
import {
  decideTransfer,
  errorMessage,
  getJson,
  sendJson,
  type ConfidenceBand,
  type GateSettings,
  type PossibleTransfer,
  type ReviewItem,
  type TransferDecision,
} from '../lib/api'
import { useApp } from '../lib/app-context'
import { useCategories } from '../lib/categories'
import { useResource } from '../lib/useResource'

type Outcome = { id: string; tone: 'success' | 'error'; text: string; proposedRule: boolean }
type Filter = 'all' | ConfidenceBand
type Pending = { key: string; kind: 'approve' | 'reject' | 'file' }
type Refocus = { id: string; nextId: string | null; heading: 'queue' | 'transfers' }

const nextAfter = (ids: string[], id: string) => {
  const i = ids.indexOf(id)
  return ids[i + 1] ?? ids[i - 1] ?? null
}

export function Review() {
  const { version, invalidate, navigate } = useApp()
  const categories = useCategories()
  const queue = useResource(
    (signal) => getJson<{ items: ReviewItem[] }>('/api/assistant/review-queue', signal).then((r) => r.items),
    version,
  )
  const gate = useResource((signal) => getJson<{ settings: GateSettings }>('/api/assistant/gate', signal).then((r) => r.settings))
  const transfers = usePossibleTransfers(version)
  const connections = useConnections()
  const rulePatterns = useRulePatterns(version)
  const items = queue.data
  const accounts = usePostingAccounts(
    (items ?? []).map((i) => i.postingId),
    version,
  )

  const [pending, setPending] = useState<Pending | null>(null)
  const [outcomes, setOutcomes] = useState<Outcome[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [decided, setDecided] = useState<ReadonlySet<string>>(new Set())
  const [transferError, setTransferError] = useState<string | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const refocus = useRef<Refocus | null>(null)

  // A disabled button drops focus to <body>; park it on the page while a write is in flight.
  useEffect(() => {
    if (pending) wrapRef.current?.focus()
  }, [pending])

  // Once the lists have refreshed, put focus on what the user was working on: the same card if it
  // is still there (a failed write), else the next card's first action, else the list heading.
  useEffect(() => {
    const r = refocus.current
    if (!r || pending || queue.loading || transfers.loading) return
    refocus.current = null
    const first = (id: string | null) =>
      id ? document.querySelector<HTMLElement>(`[data-review-id="${id}"] :is(select, button):not(:disabled)`) : null
    const target = first(r.id) ?? first(r.nextId) ?? document.querySelector<HTMLElement>(`[data-review-heading="${r.heading}"]`)
    target?.focus()
  })

  const record = (o: Outcome) => setOutcomes((prev) => [o, ...prev.filter((p) => p.id !== o.id)].slice(0, 5))

  const act = async (p: Pending, focus: Refocus, fn: () => Promise<void>) => {
    refocus.current = focus
    setPending(p)
    try {
      await fn()
    } finally {
      setPending(null)
    }
  }

  const gateBounds = gate.data ? { high: gate.data.highConfidence, low: gate.data.lowConfidence } : null
  const list = items ?? []
  const currencyOrder = [...new Set(list.map((i) => i.posting?.currency ?? ''))]
  const visible = list
    .filter((i) => filter === 'all' || i.confidenceBand === filter)
    .sort(
      (a, b) =>
        currencyOrder.indexOf(a.posting?.currency ?? '') - currencyOrder.indexOf(b.posting?.currency ?? '') ||
        Math.abs(itemAmount(b)) - Math.abs(itemAmount(a)),
    )
  const transferGroups = (transfers.data ?? [])
    .map((g) => ({ ...g, rows: g.rows.filter((r) => !decided.has(r.transactionId)) }))
    .filter((g) => g.rows.length > 0)

  const queueFocus = (item: ReviewItem): Refocus => ({
    id: item.id,
    nextId: nextAfter(visible.map((i) => i.id), item.id),
    heading: 'queue',
  })

  const transferFocus = (row: PossibleTransfer): Refocus => ({
    id: row.transactionId,
    nextId: nextAfter(transferGroups.flatMap((g) => g.rows.map((r) => r.transactionId)), row.transactionId),
    heading: 'transfers',
  })

  const categoryLabel = (id: string | null) => (id ? categories.data?.byId[id]?.label : undefined) ?? 'the suggested category'

  const resolve = (item: ReviewItem, kind: 'approve' | 'reject') =>
    act({ key: item.id, kind }, queueFocus(item), async () => {
      const who = itemName(item)
      try {
        if (kind === 'approve') {
          const res = await sendJson<{ approved: string; proposedRuleId: string | null }>(
            'POST',
            `/api/assistant/review-queue/${item.id}/approve`,
          )
          record({
            id: item.id,
            tone: 'success',
            text: `${who}: filed under ${categoryLabel(item.suggestedCategoryId)}.`,
            proposedRule: !!res.proposedRuleId,
          })
        } else {
          await sendJson('POST', `/api/assistant/review-queue/${item.id}/reject`)
          record({ id: item.id, tone: 'success', text: `${who}: rejected — it stays uncategorized and counted.`, proposedRule: false })
        }
      } catch (e) {
        record({ id: item.id, tone: 'error', text: `${who}: ${errorMessage(e)}`, proposedRule: false })
      }
      invalidate()
    })

  const file = (item: ReviewItem, categoryId: string) =>
    act({ key: item.id, kind: 'file' }, queueFocus(item), async () => {
      const who = itemName(item)
      try {
        const res = await sendJson<{ proposedRuleId: string | null }>('POST', `/api/ledger/postings/${item.postingId}/category`, {
          categoryId,
        })
        record({ id: item.id, tone: 'success', text: `${who}: filed under ${categoryLabel(categoryId)}.`, proposedRule: !!res.proposedRuleId })
        invalidate()
      } catch (e) {
        record({ id: item.id, tone: 'error', text: `${who}: ${errorMessage(e)}`, proposedRule: false })
      }
    })

  const decide = (row: PossibleTransfer, decision: TransferDecision) =>
    act({ key: `transfer:${row.transactionId}:${decision}`, kind: 'file' }, transferFocus(row), async () => {
      setTransferError(null)
      try {
        await decideTransfer(row.transactionId, decision)
        setDecided((prev) => new Set(prev).add(row.transactionId))
        invalidate()
      } catch (e) {
        setTransferError(errorMessage(e))
        invalidate()
      }
    })

  if (!items && !queue.error) return <Loading label="Loading review queue" rows={4} />

  const counts: Record<ConfidenceBand, number> = { high: 0, medium: 0, low: 0 }
  for (const i of list) counts[i.confidenceBand] += 1

  const stake = atStakeByCurrency(list)
  const tiles = items ? tilesFor(items, accounts.data) : null

  return (
    <div ref={wrapRef} tabIndex={-1} className="flex flex-col gap-6 outline-none">
      {items && items.length > 0 && <Hero count={items.length} stake={stake} high={gateBounds?.high ?? null} />}
      {items && <TrustLine count={items.length} stake={stake} transfers={transferGroups} connections={connections.data} />}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:gap-x-[26px]">
        <div className="flex min-w-0 flex-col gap-4">
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
          {categories.error && <Notice tone="error">Categories unavailable: {categories.error}</Notice>}
          {!items ? (
            <ErrorState title="Couldn't load the review queue" message={queue.error} onRetry={queue.reload} />
          ) : items.length === 0 ? (
            <div className="rounded-lg border border-line bg-surface px-6 py-8 shadow-1">
              <p tabIndex={-1} data-review-heading="queue" className="font-display text-xl font-bold text-ink outline-none">
                Nothing waiting for review
              </p>
              <p className="mt-1 max-w-prose text-sm text-ink-3">
                New suggestions appear after you run categorization on Transactions. Anything the model auto-applies never lands
                here.
              </p>
              <div className="mt-4">
                <Button size="sm" onClick={() => navigate('transactions')}>
                  Open Transactions
                </Button>
              </div>
            </div>
          ) : (
            <>
              <ConfidenceSplit counts={counts} bounds={gateBounds} minVendor={gate.data?.minVendorOccurrences ?? null} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2
                  tabIndex={-1}
                  data-review-heading="queue"
                  className="font-display text-[17px] font-bold text-ink outline-none"
                >
                  Waiting <span className="font-normal text-ink-3">· largest amount first</span>
                </h2>
                <Segmented<Filter>
                  label="Filter by confidence"
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: 'all', label: `All ${items.length}` },
                    { value: 'high', label: `High ${counts.high}` },
                    { value: 'medium', label: `Medium ${counts.medium}` },
                    { value: 'low', label: `Low ${counts.low}` },
                  ]}
                />
              </div>
              {visible.length === 0 && <p className="text-sm text-ink-3">Nothing in this band.</p>}
              <div className="flex flex-col gap-3">
                {visible.map((item) => (
                  <QueueCard
                    key={item.id}
                    item={item}
                    catalogue={categories.data}
                    catalogueFailed={!!categories.error}
                    threshold={gateBounds?.high ?? null}
                    account={accounts.data?.get(item.postingId)?.name}
                    ruleExists={!!item.posting?.counterpartyRaw && !!rulePatterns.data?.has(item.posting.counterpartyRaw.toLowerCase())}
                    disabled={pending !== null}
                    pendingKind={pending?.key === item.id ? pending.kind : null}
                    onApprove={() => resolve(item, 'approve')}
                    onReject={() => resolve(item, 'reject')}
                    onFile={(id) => file(item, id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        <aside className="flex min-w-0 flex-col gap-4">
          {tiles && <AtStake tiles={tiles} />}
          <TransferCard
            groups={transferGroups}
            disabled={pending !== null}
            pendingKey={pending?.key ?? null}
            error={transferError}
            onDecide={decide}
          />
          <AfterDecide />
        </aside>
      </div>
    </div>
  )
}
