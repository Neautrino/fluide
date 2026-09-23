import { useEffect, useState } from 'react'

/** SOURCE OF TRUTH: read-only proof-of-connection view.
 * WHAT: calls GET /plaid/transactions and renders whatever Plaid's sandbox
 * actually returns — real (simulated) account + transaction data, not
 * hardcoded fixtures.
 * WHY: this is Slice 0's walking-skeleton proof — the UI must show data
 * that genuinely round-tripped through Plaid, not a mockup. No amount
 * sign-normalization or categorization happens here on purpose: that logic
 * belongs to packages/connectors + packages/ledger once they exist, not to
 * a display component (see AGENTS.md — never silently guess/transform).
 * WHERE: owns rendering only. It refetches on mount and via the `refreshKey`
 * prop the parent bumps after a new connection succeeds.
 */

type Transaction = {
  transaction_id: string
  name: string
  amount: number
  iso_currency_code: string | null
  date: string
  pending: boolean
}

type Account = {
  account_id: string
  name: string
  type: string
  subtype: string | null
  balances: { available: number | null; current: number | null }
}

type Props = {
  refreshKey: number
}

export function TransactionList({ refreshKey }: Props) {
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'empty' }
    | { status: 'error'; message: string }
    | { status: 'ready'; accounts: Account[]; added: Transaction[] }
  >({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })
    fetch('/plaid/transactions')
      .then(async (res) => {
        if (res.status === 404) {
          if (!cancelled) setState({ status: 'empty' })
          return
        }
        if (!res.ok) throw new Error('request failed')
        const data = await res.json()
        if (!cancelled) {
          setState({ status: 'ready', accounts: data.accounts ?? [], added: data.added ?? [] })
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', message: 'Could not load transactions.' })
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
        No accounts connected yet — connect one above to see real sandbox data here.
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
          Accounts
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {state.accounts.map((acct) => (
            <div
              key={acct.account_id}
              className="rounded-xl p-4"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-standard)',
              }}
            >
              <p className="text-sm font-medium">{acct.name}</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {acct.type} · {acct.subtype ?? '—'}
              </p>
              <p className="mt-2 font-mono text-lg font-semibold">
                {acct.balances.current !== null ? `$${acct.balances.current.toFixed(2)}` : '—'}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
          Recent transactions
        </h2>
        {state.added.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            No transactions synced yet — sandbox accounts can take a moment to populate.
          </p>
        ) : (
          <div
            className="overflow-hidden rounded-xl"
            style={{ border: '1px solid var(--border-standard)', background: 'var(--bg-surface)' }}
          >
            {state.added.slice(0, 15).map((tx, i) => (
              <div
                key={tx.transaction_id}
                className="flex items-center justify-between px-4 py-3"
                style={{
                  borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <p className="text-sm">{tx.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {tx.date}
                    {tx.pending ? ' · pending' : ''}
                  </p>
                </div>
                <p
                  className="font-mono text-sm font-medium"
                  style={{ color: tx.amount > 0 ? 'var(--text-primary)' : 'var(--success)' }}
                >
                  {tx.amount > 0 ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
