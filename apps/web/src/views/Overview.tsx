import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { currentMonth } from '../components/cashflow/figures'
import { CashOnHand } from '../components/overview/CashOnHand'
import { ConnectFirst } from '../components/overview/ConnectFirst'
import { toLatest } from '../components/overview/data'
import { LatestTransactions } from '../components/overview/LatestTransactions'
import { freshness } from '../components/overview/model'
import { NeedsYouStrip } from '../components/overview/NeedsYouStrip'
import { OwnAndOwe } from '../components/overview/OwnAndOwe'
import { PromptChips } from '../components/overview/PromptChips'
import { SpendByMonth } from '../components/overview/SpendByMonth'
import { WhereItWent } from '../components/overview/WhereItWent'
import { useApp, useDisplayCurrency } from '../lib/app-context'
import {
  accountBalancesOptions,
  cashFlowOptions,
  connectionsOptions,
  possibleTransfersOptions,
  reviewQueueOptions,
  transactionsOptions,
} from '../lib/queries'

export function Overview() {
  const { ask } = useApp()
  const queryClient = useQueryClient()
  const currency = useDisplayCurrency()
  const [now] = useState(Date.now)
  const [month] = useState(currentMonth)

  const flow = useQuery(cashFlowOptions({ month, compare: 'average', accounts: [], currency }))
  const accounts = useQuery(accountBalancesOptions())
  const connections = useQuery(connectionsOptions())
  const review = useQuery(reviewQueueOptions())
  const transfers = useQuery(possibleTransfersOptions())
  const latest = useQuery({ ...transactionsOptions(), select: toLatest })

  const balances = accounts.isError ? undefined : accounts.data
  if (balances?.length === 0) return <ConnectFirst onConnected={() => void queryClient.invalidateQueries()} />

  const fresh = freshness(balances, connections.isError ? undefined : connections.data, now)

  return (
    <div className="flex flex-col gap-5">
      <PromptChips flow={flow.isError ? undefined : flow.data} ask={ask} />
      <NeedsYouStrip connections={connections} review={review} transfers={transfers} now={now} />
      <div className="grid grid-cols-1 items-start gap-4 min-[1280px]:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <CashOnHand accounts={accounts} currency={currency} currencyKnown fresh={fresh} />
          <OwnAndOwe accounts={accounts} connections={connections} currency={currency} currencyKnown now={now} />
          <LatestTransactions latest={latest} currency={currency} fresh={fresh} />
        </div>
        <div className="mx-auto flex w-full min-w-0 max-w-[480px] flex-col gap-4 min-[1280px]:max-w-none">
          <SpendByMonth flow={flow} review={review} fresh={fresh} />
          <WhereItWent flow={flow} review={review} fresh={fresh} />
        </div>
      </div>
    </div>
  )
}
