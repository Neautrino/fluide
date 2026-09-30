import {
  getJson,
  listPossibleTransfers,
  type ConnectionSummary,
  type PossibleTransfer,
  type Rule,
} from '../../lib/api'
import { useResource } from '../../lib/useResource'

export type TransferGroup = { currency: string; rows: PossibleTransfer[] }

/** Every unpaired transfer, per currency in the summary's order; currencies with none are left out. */
export function usePossibleTransfers(version: number) {
  return useResource(async (signal) => {
    const { currencies } = await getJson<{ currencies: string[] }>('/api/ledger/summary?period=all_time', signal)
    const groups = await Promise.all(
      currencies.map(async (currency) => ({
        currency,
        rows: (await listPossibleTransfers('all_time', currency, signal)).sort(
          (a, b) => Math.abs(b.amount) - Math.abs(a.amount),
        ),
      })),
    )
    return groups.filter((g) => g.rows.length > 0)
  }, version)
}

export type PostingAccount = { accountId: string; name: string }

type TransactionsResponse = {
  transactions: { posting: { id: string; accountId: string } | null; account: { name: string } | null }[]
}

/** Lazy: the endpoint returns every transaction, so it is only fetched while something is waiting; refetched when the waiting set changes. */
export function usePostingAccounts(postingIds: string[], version: number) {
  const key = postingIds.length === 0 ? null : `${version}:${postingIds.join(',')}`
  return useResource(async (signal) => {
    const map = new Map<string, PostingAccount>()
    if (key === null) return map
    const { transactions } = await getJson<TransactionsResponse>('/api/ledger/transactions', signal)
    for (const t of transactions) if (t.posting && t.account) map.set(t.posting.id, { accountId: t.posting.accountId, name: t.account.name })
    return map
  }, key)
}

export function useConnections() {
  return useResource((signal) =>
    getJson<{ connections: ConnectionSummary[] }>('/api/providers/connections', signal).then((r) => r.connections),
  )
}

export function useRulePatterns(version: number) {
  return useResource(
    (signal) =>
      getJson<{ rules: Rule[] }>('/api/assistant/rules', signal).then((r) => new Set(r.rules.map((x) => x.pattern.toLowerCase()))),
    version,
  )
}
