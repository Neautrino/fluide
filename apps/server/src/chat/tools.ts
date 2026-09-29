/* SOURCE OF TRUTH: the chat model's tool surface.
 * Invariant: every tool wraps a read-only @repo/ledger query bound to LOCAL_TENANT_ID; the model never computes a number.
 * Never: add a write tool or return a credential to the model.
 * See: ADR 001 — tools and HTTP routes share one read layer
 */
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import {
  getCurrencyBreakdown,
  spendingInCategory,
  listAccountBalances,
  listRecentTransactions,
  type Period,
} from '@repo/ledger'
import { LOCAL_TENANT_ID } from '../ingest.js'

const periodSchema = z
  .enum(['this_week', 'this_month', 'last_30_days', 'this_year', 'all_time'])
  .describe('Time window to aggregate over.')

export const chatTools = [
  tool(
    async ({ period, limit }: { period: Period; limit?: number }) => {
      const blocks = await getCurrencyBreakdown(LOCAL_TENANT_ID, period)
      return JSON.stringify(blocks.map((b) => ({ currency: b.currency, categories: b.categories.slice(0, limit ?? 5) })))
    },
    {
      name: 'top_expense_categories',
      description:
        "Get the user's biggest spending categories for a time period, ranked highest to lowest. " +
        'Returns one block per currency, most-used currency first; never add totals across currencies.',
      schema: z.object({
        period: periodSchema,
        limit: z.number().int().positive().max(20).optional().describe('How many categories to return per currency, default 5.'),
      }),
    },
  ),
  tool(
    async ({ category, period }: { category: string; period: Period }) => {
      const blocks = await spendingInCategory(LOCAL_TENANT_ID, category, period)
      return JSON.stringify(blocks)
    },
    {
      name: 'spending_in_category',
      description:
        'Get total spending in one specific category (e.g. "groceries", "coffee") for a time period. ' +
        'Returns one block per currency, most-used currency first; never add totals across currencies.',
      schema: z.object({
        category: z.string().describe('Category name or partial name to match, e.g. "Groceries".'),
        period: periodSchema,
      }),
    },
  ),
  tool(
    async ({ period }: { period: Period }) => {
      const blocks = await getCurrencyBreakdown(LOCAL_TENANT_ID, period)
      return JSON.stringify(
        blocks.map(({ currency, income, expense, net, spending, debtPayments }) => ({
          currency,
          income,
          expense,
          net,
          spending,
          debtPayments,
        })),
      )
    },
    {
      name: 'income_vs_expense',
      description:
        'Get total income, total expense, and net for a time period. expense = spending + debtPayments ' +
        '(loan payments); confirmed own-account transfers, credit-card payments and investment moves are excluded ' +
        'from both sides. Bank-tagged transfers the user has not confirmed (they may be payments to other people) are counted. ' +
        'Returns one block per currency, most-used currency first; never add totals across currencies.',
      schema: z.object({ period: periodSchema }),
    },
  ),
  tool(
    async ({ period, limit }: { period: Period; limit?: number }) => {
      const blocks = await getCurrencyBreakdown(LOCAL_TENANT_ID, period)
      return JSON.stringify(blocks.map((b) => ({ currency: b.currency, merchants: b.merchants.slice(0, limit ?? 5) })))
    },
    {
      name: 'top_merchants',
      description:
        "Get the merchants/vendors the user spent the most with, ranked highest to lowest. " +
        'Returns one block per currency, most-used currency first; never add totals across currencies.',
      schema: z.object({
        period: periodSchema,
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
    async ({ period, merchant, limit }: { period: Period; merchant?: string; limit?: number }) => {
      const rows = await listRecentTransactions(LOCAL_TENANT_ID, period, merchant, limit ?? 20)
      return JSON.stringify(rows)
    },
    {
      name: 'list_recent_transactions',
      description:
        'List individual transactions (date, description, merchant, amount, category), newest first -- ' +
        'for specific/non-aggregate questions the other tools can\'t answer, e.g. "show me my Uber ' +
        'transactions" or "what did I buy last week". Optionally filtered to one merchant.',
      schema: z.object({
        period: periodSchema,
        merchant: z.string().optional().describe('Filter to transactions matching this merchant/vendor name, e.g. "Uber". Omit to list all.'),
        limit: z.number().int().positive().max(50).optional().describe('Max transactions to return, default 20, capped at 50.'),
      }),
    },
  ),
]
