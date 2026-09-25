import { and, eq, gte } from 'drizzle-orm'
import { accounts, transactions } from '../schema/index.js'

export const PERIODS = ['this_week', 'this_month', 'last_30_days', 'this_year', 'all_time'] as const
export type Period = (typeof PERIODS)[number]

function periodStart(period: Period): Date | undefined {
  const now = new Date()
  switch (period) {
    case 'this_week': {
      const d = new Date(now)
      d.setDate(d.getDate() - d.getDay())
      d.setHours(0, 0, 0, 0)
      return d
    }
    case 'this_month':
      return new Date(now.getFullYear(), now.getMonth(), 1)
    case 'last_30_days':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    case 'this_year':
      return new Date(now.getFullYear(), 0, 1)
    case 'all_time':
      return undefined
  }
}

export function bankPostingsFilter(tenantId: string, period: Period) {
  const start = periodStart(period)
  const conditions = [eq(transactions.tenantId, tenantId), eq(accounts.type, 'asset' as const)]
  if (start) conditions.push(gte(transactions.date, start))
  return and(...conditions)
}
