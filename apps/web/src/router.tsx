import { createRootRoute, createRoute, createRouter, stripSearchParams, type SearchSchemaInput } from '@tanstack/react-router'
import type { ReviewFilter } from './components/review/helpers'
import type { RuleTab } from './components/rules/model'
import type { CashFlowCompare } from './lib/api'
import { consumeEnableBankingCallback } from './lib/enable-banking'
import { CurrencyGate, ErrorScreen, NotFound, RootLayout } from './Shell'
import { Accounts } from './views/Accounts'
import { CashFlow } from './views/CashFlow'
import { Overview } from './views/Overview'
import { Review } from './views/Review'
import { Rules } from './views/Rules'
import { Settings } from './views/Settings'
import { Transactions } from './views/Transactions'

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/
const COMPARE: Record<string, CashFlowCompare> = { average: 'average', previous: 'previous', last_year: 'last_year' }
const BAND: Record<string, ReviewFilter> = { all: 'all', high: 'high', medium: 'medium', low: 'low' }
const TAB: Record<string, RuleTab> = { active: 'active', off: 'off' }

const asOneOf = <T extends string>(table: Record<string, T>, fallback: T, value: unknown): T =>
  typeof value === 'string' && Object.hasOwn(table, value) ? table[value] : fallback

const CASHFLOW_DEFAULTS: { compare: CashFlowCompare; accounts: string[] } = { compare: 'average', accounts: [] }
const TRANSACTIONS_DEFAULTS = { q: '', category: '' }
const RULES_DEFAULTS: { tab: RuleTab } = { tab: 'active' }
const REVIEW_DEFAULTS: { filter: ReviewFilter } = { filter: 'all' }

const rootRoute = createRootRoute({ component: RootLayout })

const currencyRoute = createRoute({ getParentRoute: () => rootRoute, id: 'currency', component: CurrencyGate })

const overviewRoute = createRoute({ getParentRoute: () => currencyRoute, path: '/', component: Overview })

const accountsRoute = createRoute({
  getParentRoute: () => currencyRoute,
  path: '/accounts',
  component: Accounts,
  validateSearch: (search: { account?: string } & SearchSchemaInput) => ({
    account: typeof search.account === 'string' && search.account !== '' ? search.account : undefined,
  }),
})

const cashFlowRoute = createRoute({
  getParentRoute: () => currencyRoute,
  path: '/cashflow',
  component: CashFlow,
  validateSearch: (search: { month?: string; compare?: CashFlowCompare; accounts?: string[] } & SearchSchemaInput) => ({
    month: typeof search.month === 'string' && MONTH_PATTERN.test(search.month) ? search.month : undefined,
    compare: asOneOf(COMPARE, CASHFLOW_DEFAULTS.compare, search.compare),
    accounts: Array.isArray(search.accounts) ? search.accounts.filter((id) => typeof id === 'string') : [],
  }),
  search: { middlewares: [stripSearchParams(CASHFLOW_DEFAULTS)] },
})

const transactionsRoute = createRoute({
  getParentRoute: () => currencyRoute,
  path: '/transactions',
  component: Transactions,
  validateSearch: (search: { q?: string; category?: string } & SearchSchemaInput) => ({
    q: typeof search.q === 'string' ? search.q : TRANSACTIONS_DEFAULTS.q,
    category: typeof search.category === 'string' ? search.category : TRANSACTIONS_DEFAULTS.category,
  }),
  search: { middlewares: [stripSearchParams(TRANSACTIONS_DEFAULTS)] },
})

const reviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/review',
  component: Review,
  validateSearch: (search: { filter?: ReviewFilter } & SearchSchemaInput) => ({
    filter: asOneOf(BAND, REVIEW_DEFAULTS.filter, search.filter),
  }),
  search: { middlewares: [stripSearchParams(REVIEW_DEFAULTS)] },
})

const rulesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/rules',
  component: Rules,
  validateSearch: (search: { tab?: RuleTab } & SearchSchemaInput) => ({
    tab: asOneOf(TAB, RULES_DEFAULTS.tab, search.tab),
  }),
  search: { middlewares: [stripSearchParams(RULES_DEFAULTS)] },
})

const settingsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: Settings })

const assistantRoute = createRoute({ getParentRoute: () => rootRoute, path: '/assistant', component: () => null })

const routeTree = rootRoute.addChildren([
  currencyRoute.addChildren([overviewRoute, accountsRoute, cashFlowRoute, transactionsRoute]),
  reviewRoute,
  rulesRoute,
  settingsRoute,
  assistantRoute,
])

// Must run before createRouter: it strips the single-use bank code from the URL with
// replaceState, so the router's history never sees /connect/enable-banking/callback.
consumeEnableBankingCallback()

export const router = createRouter({
  routeTree,
  scrollRestoration: true,
  defaultErrorComponent: ErrorScreen,
  defaultNotFoundComponent: NotFound,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
