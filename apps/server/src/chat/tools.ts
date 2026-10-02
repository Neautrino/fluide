/* SOURCE OF TRUTH: the chat model's tool surface.
 * Invariant: every tool wraps a read-only @repo/ledger query bound to LOCAL_TENANT_ID; the model never computes a number.
 * Never: add a write tool or return a credential to the model.
 * See: ADR 001 — tools and HTTP routes share one read layer
 */
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import {
  PERIODS,
  getCurrencyBreakdown,
  isMonth,
  listAccountBalances,
  listRecentTransactions,
  monthWindow,
  periodWindow,
  spendingInCategory,
  type Period,
  type ScopeWindow,
} from '@repo/ledger'
import { LOCAL_TENANT_ID } from '../ingest.js'

const DAY_MS = 24 * 60 * 60 * 1000

const periodSchema = z
  .enum(PERIODS)
  .describe(
    'Time window to aggregate over, in UTC calendar terms: this_week/this_month/this_year run to today; ' +
      'last_month and last_year are the whole previous calendar month/year; last_30_days is a rolling window. ' +
      'Ignored when month is given.',
  )
const monthSchema = z
  .string()
  .refine(isMonth, 'month must be YYYY-MM')
  .optional()
  .describe('One specific calendar month as YYYY-MM, e.g. "2026-09". When given it overrides period.')

const PERIOD_LABELS: Record<Period, string> = {
  this_week: 'this week, to date',
  this_month: 'this month, to date',
  last_month: 'last month',
  last_30_days: 'the last 30 days',
  this_year: 'this year, to date',
  last_year: 'last year',
  all_time: 'all time',
}

type WindowArgs = { period: Period; month?: string }

/** The bounds a tool queries, plus the window it reports back so the model can
 * name the period: `to` is the last day included, today for a window still running;
 * `from` is null for all time. */
function resolveWindow({ period, month }: WindowArgs, now = new Date()) {
  const scope: ScopeWindow = month ? monthWindow(month, now) : periodWindow(period, now)
  const lastDay = scope.end ? new Date(scope.end.getTime() - DAY_MS) : now
  const to = scope.start && scope.start <= now && lastDay > now ? now : lastDay
  const monthName = scope.start?.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const label = month
    ? monthName!
    : period === 'this_month' || period === 'last_month'
      ? `${PERIOD_LABELS[period]} (${monthName})`
      : period === 'this_year' || period === 'last_year'
        ? `${PERIOD_LABELS[period]} (${scope.start!.getUTCFullYear()})`
        : PERIOD_LABELS[period]
  return {
    scope,
    window: { from: scope.start?.toISOString().slice(0, 10) ?? null, to: to.toISOString().slice(0, 10), label },
  }
}

export const chatTools = [
  tool(
    async ({ limit, ...args }: WindowArgs & { limit?: number }) => {
      const { scope, window } = resolveWindow(args)
      const blocks = await getCurrencyBreakdown(LOCAL_TENANT_ID, scope)
      return JSON.stringify({
        window,
        currencies: blocks.map((b) => ({ currency: b.currency, categories: b.categories.slice(0, limit ?? 5) })),
      })
    },
    {
      name: 'top_expense_categories',
      description:
        "Get the user's biggest spending categories for a time period, ranked highest to lowest. " +
        'Returns the resolved window and one block per currency, most-used currency first; never add totals across currencies.',
      schema: z.object({
        period: periodSchema,
        month: monthSchema,
        limit: z.number().int().positive().max(20).optional().describe('How many categories to return per currency, default 5.'),
      }),
    },
  ),
  tool(
    async ({ category, ...args }: WindowArgs & { category: string }) => {
      const { scope, window } = resolveWindow(args)
      return JSON.stringify({ window, currencies: await spendingInCategory(LOCAL_TENANT_ID, category, scope) })
    },
    {
      name: 'spending_in_category',
      description:
        'Get total spending in one specific category (e.g. "groceries", "coffee") for a time period. ' +
        'Returns the resolved window and one block per currency, most-used currency first; never add totals across currencies.',
      schema: z.object({
        category: z.string().describe('Category name or partial name to match, e.g. "Groceries".'),
        period: periodSchema,
        month: monthSchema,
      }),
    },
  ),
  tool(
    async (args: WindowArgs) => {
      const { scope, window } = resolveWindow(args)
      const blocks = await getCurrencyBreakdown(LOCAL_TENANT_ID, scope)
      return JSON.stringify({
        window,
        currencies: blocks.map(({ currency, income, expense, net, spending, debtPayments }) => ({
          currency,
          income,
          expense,
          net,
          spending,
          debtPayments,
        })),
      })
    },
    {
      name: 'income_vs_expense',
      description:
        'Get total income, total expense, and net for a time period. expense = spending + debtPayments ' +
        '(loan payments); confirmed own-account transfers, credit-card payments and investment moves are excluded ' +
        'from both sides. Bank-tagged transfers the user has not confirmed (they may be payments to other people) are counted. ' +
        'Returns the resolved window and one block per currency, most-used currency first; never add totals across currencies.',
      schema: z.object({ period: periodSchema, month: monthSchema }),
    },
  ),
  tool(
    async ({ limit, ...args }: WindowArgs & { limit?: number }) => {
      const { scope, window } = resolveWindow(args)
      const blocks = await getCurrencyBreakdown(LOCAL_TENANT_ID, scope)
      return JSON.stringify({
        window,
        currencies: blocks.map((b) => ({ currency: b.currency, merchants: b.merchants.slice(0, limit ?? 5) })),
      })
    },
    {
      name: 'top_merchants',
      description:
        'Get the merchants/vendors the user spent the most with, ranked highest to lowest. Spending only: ' +
        'money received, own-account transfers, card payments, investment moves and loan payments are not merchants. ' +
        'Returns the resolved window and one block per currency, most-used currency first; never add totals across currencies.',
      schema: z.object({
        period: periodSchema,
        month: monthSchema,
        limit: z.number().int().positive().max(20).optional().describe('How many merchants to return per currency, default 5.'),
      }),
    },
  ),
  tool(
    async () => {
      const rows = await listAccountBalances(LOCAL_TENANT_ID)
      return JSON.stringify(rows)
    },
    {
      name: 'list_account_balances',
      description:
        "List the user's connected bank accounts with their current balances. " +
        'A row with countsTowardTotals false (its login was disconnected or replaced, or the user excluded it) ' +
        'must never be added into a net worth, assets or debt total.',
      schema: z.object({}),
    },
  ),
  tool(
    async ({ merchant, limit, ...args }: WindowArgs & { merchant?: string; limit?: number }) => {
      const { scope, window } = resolveWindow(args)
      const rows = await listRecentTransactions(LOCAL_TENANT_ID, scope, merchant, limit ?? 20)
      return JSON.stringify({ window, transactions: rows })
    },
    {
      name: 'list_recent_transactions',
      description:
        'List individual transactions (date, description, merchant, amount, category), newest first -- ' +
        'for specific/non-aggregate questions the other tools can\'t answer, e.g. "show me my Uber ' +
        'transactions" or "what did I buy last week". Optionally filtered to one merchant. ' +
        'Returns the resolved window with the rows.',
      schema: z.object({
        period: periodSchema,
        month: monthSchema,
        merchant: z.string().optional().describe('Filter to transactions matching this merchant/vendor name, e.g. "Uber". Omit to list all.'),
        limit: z.number().int().positive().max(50).optional().describe('Max transactions to return, default 20, capped at 50.'),
      }),
    },
  ),
]
