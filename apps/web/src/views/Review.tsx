import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { Button, ErrorState, Loading, Notice, Segmented } from '@repo/ui/primitives'
import {
  AfterDecide,
  AtStake,
  atStakeByCurrency,
  ConfidenceSplit,
  itemAmount,
  itemName,
  QueueCard,
  ReviewHero,
  ReviewTrustLine,
  ReviewView,
  tilesFor,
  TransferCard,
  type ReviewFilter,
} from '@repo/ui/review'
import {
  decideTransfer,
  errorMessage,
  sendJson,
  type ConfidenceBand,
  type PossibleTransfer,
  type ReviewItem,
  type TransferDecision,
} from '../lib/api'
import {
  connectionsOptions,
  gateOptions,
  possibleTransfersOptions,
  queryError,
  reviewQueueOptions,
  useCategories,
  usePostingAccounts,
} from '../lib/queries'

type Outcome = { id: string; tone: 'success' | 'error'; text: string; rule: boolean }
type Pending = { key: string; kind: 'approve' | 'reject' | 'file' }
type Refocus = { id: string; nextId: string | null; heading: 'queue' | 'transfers' }

const nextAfter = (ids: string[], id: string) => {
  const i = ids.indexOf(id)
  return ids[i + 1] ?? ids[i - 1] ?? null
}

const route = getRouteApi('/review')

export function Review() {
  const { filter } = route.useSearch()
  const navigate = route.useNavigate()
  const queryClient = useQueryClient()
  const categories = useCategories()
  const queue = useQuery(reviewQueueOptions())
  const gate = useQuery(gateOptions())
  const transfers = useQuery(possibleTransfersOptions())
  const connections = useQuery(connectionsOptions())
  const items = queue.isError ? undefined : queue.data
  const accounts = usePostingAccounts((items ?? []).map((i) => i.postingId))

  const [pending, setPending] = useState<Pending | null>(null)
  const [outcomes, setOutcomes] = useState<Outcome[]>([])
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
    if (!r || pending || queue.isFetching || transfers.isFetching) return
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

  const gateBounds = !gate.isError && gate.data ? { high: gate.data.highConfidence, low: gate.data.lowConfidence } : null
  const list = items ?? []
  const currencyOrder = [...new Set(list.map((i) => i.posting?.currency ?? ''))]
  const visible = list
    .filter((i) => filter === 'all' || i.confidenceBand === filter)
    .sort(
      (a, b) =>
        currencyOrder.indexOf(a.posting?.currency ?? '') - currencyOrder.indexOf(b.posting?.currency ?? '') ||
        Math.abs(itemAmount(b)) - Math.abs(itemAmount(a)),
    )
  const transferGroups = (transfers.isError ? [] : (transfers.data ?? []))
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
  const filedText = (item: ReviewItem, categoryId: string | null, alsoFiled: number) =>
    `${itemName(item)}: filed under ${categoryLabel(categoryId)}${alsoFiled > 0 ? ` and ${alsoFiled} more from ${item.posting?.counterpartyRaw ?? itemName(item)}` : ''}.`

  const resolve = (item: ReviewItem, kind: 'approve' | 'reject') =>
    act({ key: item.id, kind }, queueFocus(item), async () => {
      const who = itemName(item)
      try {
        if (kind === 'approve') {
          const res = await sendJson<{ approved: string; ruleId: string | null; alsoFiled: number }>(
            'POST',
            `/api/assistant/review-queue/${item.id}/approve`,
          )
          record({ id: item.id, tone: 'success', text: filedText(item, item.suggestedCategoryId, res.alsoFiled), rule: !!res.ruleId })
        } else {
          await sendJson('POST', `/api/assistant/review-queue/${item.id}/reject`)
          record({ id: item.id, tone: 'success', text: `${who}: rejected — it stays uncategorized and counted.`, rule: false })
        }
      } catch (e) {
        record({ id: item.id, tone: 'error', text: `${who}: ${errorMessage(e)}`, rule: false })
      }
      void queryClient.invalidateQueries()
    })

  const file = (item: ReviewItem, categoryId: string) =>
    act({ key: item.id, kind: 'file' }, queueFocus(item), async () => {
      const who = itemName(item)
      try {
        const res = await sendJson<{ ruleId: string | null; alsoFiled: number }>('POST', `/api/ledger/postings/${item.postingId}/category`, {
          categoryId,
        })
        record({ id: item.id, tone: 'success', text: filedText(item, categoryId, res.alsoFiled), rule: !!res.ruleId })
        void queryClient.invalidateQueries()
      } catch (e) {
        record({ id: item.id, tone: 'error', text: `${who}: ${errorMessage(e)}`, rule: false })
      }
    })

  const decide = (row: PossibleTransfer, decision: TransferDecision) =>
    act({ key: `transfer:${row.transactionId}:${decision}`, kind: 'file' }, transferFocus(row), async () => {
      setTransferError(null)
      try {
        await decideTransfer(row.transactionId, decision)
        setDecided((prev) => new Set(prev).add(row.transactionId))
        void queryClient.invalidateQueries()
      } catch (e) {
        setTransferError(errorMessage(e))
        void queryClient.invalidateQueries()
      }
    })

  if (!items && !queue.isError) return <Loading label="Loading review queue" rows={4} />

  const counts: Record<ConfidenceBand, number> = { high: 0, medium: 0, low: 0 }
  for (const i of list) counts[i.confidenceBand] += 1
  const byVendor = new Map<string, number>()
  for (const i of list) {
    const k = i.posting?.counterpartyRaw?.toLowerCase()
    if (k) byVendor.set(k, (byVendor.get(k) ?? 0) + 1)
  }

  const stake = atStakeByCurrency(list)
  const tiles = items ? tilesFor(items, accounts.isError ? undefined : accounts.data) : null

  return (
    <ReviewView
      wrapRef={wrapRef}
      hero={items && items.length > 0 && <ReviewHero count={items.length} stake={stake} high={gateBounds?.high ?? null} />}
      trustLine={
        items && (
          <ReviewTrustLine
            count={items.length}
            stake={stake}
            transfers={transferGroups}
            connections={connections.isError ? undefined : connections.data}
          />
        )
      }
      aside={
        <>
          {tiles && <AtStake tiles={tiles} />}
          <TransferCard
            groups={transferGroups}
            disabled={pending !== null}
            pendingKey={pending?.key ?? null}
            error={transferError}
            onDecide={decide}
          />
          <AfterDecide />
        </>
      }
    >
          {outcomes.length > 0 && (
            <div className="flex flex-col gap-2" aria-live="polite">
              {outcomes.map((o) => (
                <Notice key={o.id} tone={o.tone}>
                  {o.text}
                  {o.rule && (
                    <>
                      {' '}
                      Rule saved —{' '}
                      <button type="button" className="font-medium underline underline-offset-2" onClick={() => void navigate({ to: '/rules' })}>
                        see Rules
                      </button>
                      .
                    </>
                  )}
                </Notice>
              ))}
            </div>
          )}
          {categories.isError && <Notice tone="error">Categories unavailable: {queryError(categories)}</Notice>}
          {!items ? (
            <ErrorState title="Couldn't load the review queue" message={queryError(queue)} onRetry={() => void queue.refetch()} />
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
                <Button size="sm" onClick={() => void navigate({ to: '/transactions' })}>
                  Open Transactions
                </Button>
              </div>
            </div>
          ) : (
            <>
              <ConfidenceSplit counts={counts} bounds={gateBounds} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2
                  tabIndex={-1}
                  data-review-heading="queue"
                  className="font-display text-[17px] font-bold text-ink outline-none"
                >
                  Waiting <span className="font-normal text-ink-3">· largest amount first</span>
                </h2>
                <Segmented<ReviewFilter>
                  label="Filter by confidence"
                  value={filter}
                  onChange={(next) => void navigate({ to: '/review', search: { filter: next }, resetScroll: false })}
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
                    sameVendor={byVendor.get(item.posting?.counterpartyRaw?.toLowerCase() ?? '') ?? 1}
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
    </ReviewView>
  )
}
