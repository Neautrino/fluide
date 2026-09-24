/** SOURCE OF TRUTH: the chat agent's tool surface.
 * WHAT: wraps each queries.ts function as a LangChain tool the model can
 * call.
 * WHY: the model picks which tool to call and narrates the result; it
 * never computes or states a number itself -- same "never let the model
 * guess a fact it could get wrong" principle as jev.ts/gate.ts, applied to
 * chat instead of categorization.
 * WHERE: owns tool schemas + binding to LOCAL_TENANT_ID only. Aggregation
 * lives in queries.ts; the agent loop lives in agent.ts.
 */
import { tool } from '@langchain/core/tools'
import { z } from 'zod'
import { LOCAL_TENANT_ID } from '../ingest.js'
import {
  topExpenseCategories,
  spendingInCategory,
  incomeVsExpense,
  topMerchants,
  listAccountBalances,
  listRecentTransactions,
  type Period,
} from '../queries.js'

const periodSchema = z
  .enum(['this_week', 'this_month', 'last_30_days', 'this_year', 'all_time'])
  .describe('Time window to aggregate over.')

export const chatTools = [
  tool(
    async ({ period, limit }: { period: Period; limit?: number }) => {
      const rows = await topExpenseCategories(LOCAL_TENANT_ID, period, limit ?? 5)
      return JSON.stringify(rows)
    },
    {
      name: 'top_expense_categories',
      description: "Get the user's biggest spending categories for a time period, ranked highest to lowest.",
      schema: z.object({
        period: periodSchema,
        limit: z.number().int().positive().max(20).optional().describe('How many categories to return, default 5.'),
      }),
    },
  ),
  tool(
    async ({ category, period }: { category: string; period: Period }) => {
      const result = await spendingInCategory(LOCAL_TENANT_ID, category, period)
      return JSON.stringify(result)
    },
    {
      name: 'spending_in_category',
      description: 'Get total spending in one specific category (e.g. "groceries", "coffee") for a time period.',
      schema: z.object({
        category: z.string().describe('Category name or partial name to match, e.g. "Groceries".'),
        period: periodSchema,
      }),
    },
  ),
  tool(
    async ({ period }: { period: Period }) => {
      const result = await incomeVsExpense(LOCAL_TENANT_ID, period)
      return JSON.stringify(result)
    },
    {
      name: 'income_vs_expense',
      description: 'Get total income, total expense, and net for a time period.',
      schema: z.object({ period: periodSchema }),
    },
  ),
  tool(
    async ({ period, limit }: { period: Period; limit?: number }) => {
      const rows = await topMerchants(LOCAL_TENANT_ID, period, limit ?? 5)
      return JSON.stringify(rows)
    },
    {
      name: 'top_merchants',
      description: "Get the merchants/vendors the user spent the most with, ranked highest to lowest.",
      schema: z.object({
        period: periodSchema,
        limit: z.number().int().positive().max(20).optional().describe('How many merchants to return, default 5.'),
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
      description: "List the user's connected bank accounts with their current balances.",
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
