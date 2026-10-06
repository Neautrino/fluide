import { Fragment, type ReactNode } from 'react'
import { groupByDay } from '../transactions/groupByDay'
import { DayHeading } from '../transactions/TransactionDay'
import { TransactionRow } from '../transactions/TransactionRow'
import { Empty } from '../ui/States'
import type { Latest } from './data'
import { plural, type Fresh } from './model'
import { CardLink, Freshness, OverviewCard } from './shared'

export function LatestTransactionsCard({
  data,
  currency,
  fresh,
  pending,
  onOpen,
}: {
  data: Latest | undefined
  currency: string | null
  fresh: Fresh | null
  pending?: ReactNode
  /** Opening a row and the card link both go to the transactions list. */
  onOpen?: () => void
}) {
  const open = () => onOpen?.()
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
      {pending}
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
