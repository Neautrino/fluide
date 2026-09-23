import { useEffect, useState } from 'react'

/** SOURCE OF TRUTH: read-only ledger view.
 * WHAT: calls GET /accounts and GET /transactions — real rows read back
 * from packages/ledger (Postgres), not a Plaid passthrough anymore. Every
 * transaction shown here has already passed the guardrail migration's
 * sum-to-zero check to exist at all.
 * WHY: this is Slice 0's walking-skeleton proof, now end-to-end through the
 * real ledger: connect -> ingest -> balanced postings -> this view. Amounts
 * are Fluide's normalized sign convention (negative = spent, positive =
 * received — see packages/connectors/src/types.ts), NOT Plaid's raw
 * convention — do not re-flip the sign here, the ingest job already did it.
 * WHERE: owns rendering only. It refetches on mount and via the
 * `refreshKey` prop the parent bumps after a new connection succeeds.
 */

type Account = {
  id: string
  name: string
  type: string
  path: string
  currency: string
}

type LedgerRow = {
  id: string
  date: string
  description: string
  status: string
  posting: {
    accountId: string
    amount: string // numeric comes back as a string from Postgres/drizzle
    currency: string
  }
}

type Props = {
  refreshKey: number
}

export function TransactionList({ refreshKey }: Props) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'empty' }
    | { status: 'error'; message: string }
    | { status: 'ready'; accounts: Account[]; transactions: LedgerRow[] }
  >({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    Promise.all([
      fetch('/accounts').then((r) => r.json()),
      fetch('/transactions').then((r) => r.json()),
    ])
      .then(([accountsRes, txRes]) => {
        if (cancelled) return
        const accts: Account[] = accountsRes.accounts ?? []
        const txs: LedgerRow[] = txRes.transactions ?? []
        if (accts.length === 0) {
          setState({ status: 'empty' })
          return
        }
        setState({ status: 'ready', accounts: accts, transactions: txs })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', message: 'Could not load the ledger.' })
      })
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  if (state.status === 'loading') {
    return <p style={{ color: 'var(--text-tertiary)' }}>Loading…</p>
  }
  if (state.status === 'empty') {
    return (
      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
        No accounts connected yet — connect one above to see real ledger data here.
      </p>
    )
  }
  if (state.status === 'error') {
    return (
      <p className="text-sm" style={{ color: 'var(--danger)' }}>
        {state.message}
      </p>
    )
  }

  // Only show postings against a real bank account (skip the equity
  // suspense-account leg of each pair) — this is a display filter, the
  // ledger itself still stores both balanced sides.
  const bankAccountIds = new Set(
    state.accounts.filter((a) => a.type === 'asset').map((a) => a.id),
  )
  const visibleTxs = state.transactions.filter((tx) => bankAccountIds.has(tx.posting.accountId))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
          Accounts
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {state.accounts
            .filter((a) => a.type === 'asset')
            .map((acct) => (
              <div
                key={acct.id}
                className="rounded-xl p-4"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-standard)',
                }}
              >
                <p className="text-sm font-medium">{acct.name}</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {acct.path}
                </p>
              </div>
            ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
          Recent transactions (from the ledger)
        </h2>
        {visibleTxs.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            No transactions ingested yet — sandbox accounts can take a moment to populate.
          </p>
        ) : (
          <div
            className="overflow-hidden rounded-xl"
            style={{ border: '1px solid var(--border-standard)', background: 'var(--bg-surface)' }}
          >
            {visibleTxs.slice(0, 15).map((tx, i) => {
              const amount = parseFloat(tx.posting.amount)
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between px-4 py-3"
                  style={{
                    borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                  }}
                >
                  <div>
                    <p className="text-sm">{tx.description}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {tx.date.slice(0, 10)}
                      {tx.status === 'pending' ? ' · pending' : ''}
                    </p>
                  </div>
                  <p
                    className="font-mono text-sm font-medium"
                    style={{ color: amount < 0 ? 'var(--text-primary)' : 'var(--success)' }}
                  >
                    {amount < 0 ? '-' : '+'}${Math.abs(amount).toFixed(2)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
