import { useEffect, useState } from 'react'

/** SOURCE OF TRUTH: the S1-5 review queue UI.
 * WHAT: lists pending review_queue items (S1-4's gate output) and lets a
 * human approve or reject each one via POST /api/review-queue/:id/approve
 * or /reject.
 * WHY: S1-4 built the gate + queue with no way to act on it except curl.
 * A queued suggestion is a real decision waiting on a human -- this is
 * that human's only entry point.
 * WHERE: owns rendering + the approve/reject actions only. It does not
 * call /api/categorize itself -- that stays a separate, explicit action.
 */

type ReviewItem = {
  id: string
  postingId: string
  suggestedCategoryId: string | null
  confidenceBand: 'high' | 'medium' | 'low'
  source: string
  confidence: string
  reason: string
  status: string
  createdAt: string
}

type Category = {
  id: string
  detailed: string
  label: string
}

export function ReviewQueue() {
  const [items, setItems] = useState<ReviewItem[]>([])
  const [categoriesById, setCategoriesById] = useState<Record<string, Category>>({})
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [actingOn, setActingOn] = useState<string | null>(null)

  const load = () => {
    setStatus('loading')
    Promise.all([
      fetch('/api/review-queue').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ])
      .then(([queueRes, catRes]) => {
        const cats: Category[] = catRes.categories ?? []
        const byId: Record<string, Category> = {}
        for (const c of cats) byId[c.id] = c
        setCategoriesById(byId)
        setItems(queueRes.items ?? [])
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }

  useEffect(() => {
    load()
  }, [])

  const resolve = async (id: string, action: 'approve' | 'reject') => {
    setActingOn(id)
    try {
      const res = await fetch(`/api/review-queue/${id}/${action}`, { method: 'POST' })
      if (!res.ok) throw new Error('resolve failed')
      setItems((prev) => prev.filter((i) => i.id !== id))
    } catch {
      setStatus('error')
    } finally {
      setActingOn(null)
    }
  }

  if (status === 'loading') {
    return <p style={{ color: 'var(--text-tertiary)' }}>Loading review queue…</p>
  }
  if (status === 'error') {
    return (
      <p className="text-sm" style={{ color: 'var(--danger)' }}>
        Could not load the review queue.
      </p>
    )
  }

  return (
    <div>
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
        Review queue{items.length > 0 ? ` (${items.length})` : ''}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Nothing pending — every suggestion the AI made either auto-applied or hasn't run yet.
        </p>
      ) : (
        <div
          className="overflow-hidden rounded-xl"
          style={{ border: '1px solid var(--border-standard)', background: 'var(--bg-surface)' }}
        >
          {items.map((item, i) => {
            const cat = item.suggestedCategoryId ? categoriesById[item.suggestedCategoryId] : undefined
            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)' }}
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    {item.suggestedCategoryId ? (
                      <>
                        Suggested: <span className="font-medium">{cat?.label ?? item.suggestedCategoryId}</span>
                      </>
                    ) : (
                      <span className="font-medium" style={{ color: 'var(--text-tertiary)' }}>
                        Uncategorized (Jev confidence too low to suggest)
                      </span>
                    )}
                    <span className="ml-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {item.source} · {(Number(item.confidence) * 100).toFixed(0)}% · {item.confidenceBand}
                    </span>
                  </p>
                  <p className="mt-1 truncate text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {item.reason}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={actingOn === item.id || !item.suggestedCategoryId}
                    onClick={() => resolve(item.id, 'approve')}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-white transition disabled:opacity-50"
                    style={{ background: 'var(--success)' }}
                    title={item.suggestedCategoryId ? undefined : 'No suggestion to approve -- pick a category manually'}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={actingOn === item.id}
                    onClick={() => resolve(item.id, 'reject')}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50"
                    style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-standard)' }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
