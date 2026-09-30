import { Fragment } from 'react'
import type { View } from '../../lib/app-context'
import type { Resource } from '../../lib/useResource'
import { DayHeading } from '../TransactionDay'
import { groupByDay } from '../groupByDay'
import { TransactionRow } from '../TransactionRow'
import { Empty } from '../ui/States'
import type { Latest } from './data'
import { plural, type Fresh } from './model'
import { CardLink, Freshness, OverviewCard, Pending } from './shared'

export function LatestTransactions({
  latest,
  currency,
  fresh,
  navigate,
}: {
  latest: Resource<Latest>
  currency: string | null
  fresh: Fresh | null
  navigate: (view: View) => void
}) {
  const data = latest.data
  const open = () => navigate('transactions')

  return (
    <OverviewCard
      title="Latest transactions"
      className="overflow-hidden"
      aside={
        <>
          <Freshness fresh={fresh} />
          <CardLink onClick={open}>All transactions ›</CardLink>
        </>
      }
    >
      <Pending resource={latest} what="transactions" ready={data !== undefined} />
      {data &&
        (data.rows.length === 0 ? (
          <Empty title="No transactions yet" />
        ) : (
          <>
            <p className="mt-1 text-[12.5px] text-ink-2">
              {plural(data.total, 'transaction')} · {data.uncategorized} uncategorized
            </p>
            <div className="-mx-5 mt-2 -mb-[18px] max-[1300px]:-mx-4 [&>div]:px-5 max-[1300px]:[&>div]:px-4 [&>div:not([role=button])+[role=button]]:border-t-transparent">
              {groupByDay(data.rows).map((day) => (
                <Fragment key={day.date}>
                  <DayHeading group={day} />
                  {day.rows.map((row) => (
                    <TransactionRow key={row.key} row={row} mainCurrency={currency ?? undefined} onClick={open} />
                  ))}
                </Fragment>
              ))}
            </div>
          </>
        ))}
    </OverviewCard>
  )
}
