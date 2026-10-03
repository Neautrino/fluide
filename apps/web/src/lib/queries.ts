import { queryOptions, skipToken, useQuery } from '@tanstack/react-query'
import {
  errorMessage,
  getCashFlow,
  getCashFlowTransactions,
  getGeneralSettings,
  getJson,
  getVersionInfo,
  listPossibleTransfers,
  type Account,
  type AccountBalance,
  type AiState,
  type AuditEntry,
  type CashFlowFilter,
  type CashFlowParams,
  type Category,
  type ConnectionSummary,
  type GateSettings,
  type LedgerRow,
  type PossibleTransfer,
  type ProviderCredentialsStatus,
  type ReviewItem,
  type Rule,
} from './api'
import { buildCatalogue } from './categories'
import type { EnableBankingBank } from './enable-banking'

export type TransferGroup = { currency: string; rows: PossibleTransfer[] }

export type PostingAccount = { accountId: string; name: string }

export const connectionsOptions = () =>
  queryOptions({
    queryKey: ['providers', 'connections'],
    queryFn: ({ signal }) =>
      getJson<{ connections: ConnectionSummary[] }>('/api/providers/connections', signal).then((r) => r.connections),
  })

export const aspspsOptions = (country: string) =>
  queryOptions({
    queryKey: ['providers', 'enable-banking', 'aspsps', country],
    queryFn: country
      ? ({ signal }: { signal: AbortSignal }) =>
          getJson<{ aspsps: EnableBankingBank[] }>(`/api/providers/enable-banking/aspsps?country=${country}`, signal).then(
            (r) => r.aspsps,
          )
      : skipToken,
  })

export const accountBalancesOptions = () =>
  queryOptions({
    queryKey: ['ledger', 'account-balances'],
    queryFn: ({ signal }) =>
      getJson<{ accounts: AccountBalance[] }>('/api/ledger/account-balances', signal).then((r) => r.accounts),
  })

export const accountsOptions = () =>
  queryOptions({
    queryKey: ['ledger', 'accounts'],
    queryFn: ({ signal }) => getJson<{ accounts: Account[] }>('/api/ledger/accounts', signal).then((r) => r.accounts),
  })

export const transactionsOptions = (params: { accountId?: string } = {}) =>
  queryOptions({
    queryKey: ['ledger', 'transactions', params],
    queryFn: ({ signal }) =>
      getJson<{ transactions: LedgerRow[] }>(
        params.accountId ? `/api/ledger/transactions?accountId=${encodeURIComponent(params.accountId)}` : '/api/ledger/transactions',
        signal,
      ).then((r) => r.transactions),
  })

export const auditLogOptions = (postingId: string | undefined) =>
  queryOptions({
    queryKey: ['ledger', 'audit-log', postingId ?? null],
    queryFn: postingId
      ? ({ signal }: { signal: AbortSignal }) =>
          getJson<{ entries: AuditEntry[] }>(`/api/ledger/audit-log/${postingId}`, signal).then((r) => r.entries)
      : skipToken,
  })

export const cashFlowOptions = (params: CashFlowParams) =>
  queryOptions({ queryKey: ['ledger', 'cashflow', params], queryFn: ({ signal }) => getCashFlow(params, signal) })

export const cashFlowTransactionsOptions = (params: CashFlowParams, filter: CashFlowFilter) =>
  queryOptions({
    queryKey: ['ledger', 'cashflow-transactions', params, filter],
    queryFn: ({ signal }) => getCashFlowTransactions(params, filter, signal),
  })

/** Every unpaired transfer, per currency in the summary's order; currencies with none are left out. */
export const possibleTransfersOptions = () =>
  queryOptions({
    queryKey: ['ledger', 'possible-transfers'],
    queryFn: async ({ signal }): Promise<TransferGroup[]> => {
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
    },
  })

const categoriesOptions = () =>
  queryOptions({
    queryKey: ['ledger', 'categories'],
    queryFn: ({ signal }) =>
      getJson<{ categories: Category[] }>('/api/ledger/categories', signal).then((r) => buildCatalogue(r.categories ?? [])),
    staleTime: Infinity,
  })

export const reviewQueueOptions = () =>
  queryOptions({
    queryKey: ['assistant', 'review-queue'],
    queryFn: ({ signal }) => getJson<{ items: ReviewItem[] }>('/api/assistant/review-queue', signal).then((r) => r.items),
  })

export const gateOptions = () =>
  queryOptions({
    queryKey: ['assistant', 'gate'],
    queryFn: ({ signal }) => getJson<{ settings: GateSettings }>('/api/assistant/gate', signal).then((r) => r.settings),
  })

export const rulesOptions = () =>
  queryOptions({
    queryKey: ['assistant', 'rules'],
    queryFn: ({ signal }) => getJson<{ rules: Rule[] }>('/api/assistant/rules', signal).then((r) => r.rules),
  })

export const generalSettingsOptions = () =>
  queryOptions({ queryKey: ['settings', 'general'], queryFn: ({ signal }) => getGeneralSettings(signal) })

export const aiSettingsOptions = () =>
  queryOptions({ queryKey: ['settings', 'ai'], queryFn: ({ signal }) => getJson<AiState>('/api/settings/ai', signal) })

export const versionInfoOptions = () =>
  queryOptions({ queryKey: ['settings', 'version'], queryFn: ({ signal }) => getVersionInfo(signal) })

export const providerCredentialsOptions = (id: string) =>
  queryOptions({
    queryKey: ['settings', 'provider-credentials', id],
    queryFn: ({ signal }) => getJson<ProviderCredentialsStatus>(`/api/settings/provider-credentials/${id}`, signal),
  })

const countItems = (items: ReviewItem[]) => items.length

/** Pending review items, null while unknown (loading or endpoint down). */
export function useReviewCount(): number | null {
  const { data, isError } = useQuery({ ...reviewQueueOptions(), select: countItems })
  return isError ? null : (data ?? null)
}

export function useCategories() {
  return useQuery(categoriesOptions())
}

function postingAccounts(rows: LedgerRow[]): Map<string, PostingAccount> {
  const map = new Map<string, PostingAccount>()
  for (const t of rows) {
    if (t.posting?.id && t.account) map.set(t.posting.id, { accountId: t.posting.accountId, name: t.account.name })
  }
  return map
}

/** Lazy: the endpoint returns every transaction, so it is only fetched while something is waiting for an account name. */
export function usePostingAccounts(postingIds: string[]) {
  return useQuery({ ...transactionsOptions(), select: postingAccounts, enabled: postingIds.length > 0 })
}

/** The message to show for a failed query; null while it has not failed. */
export function queryError(query: { isError: boolean; error: unknown }): string | null {
  return query.isError ? errorMessage(query.error) : null
}
