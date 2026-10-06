import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { currentMonth } from '@repo/ui/cashflow'
import { freshness, OverviewView, PromptChips, toLatest } from '@repo/ui/overview'
import { CashOnHand } from '../components/overview/CashOnHand'
import { ConnectFirst } from '../components/overview/ConnectFirst'
import { LatestTransactions } from '../components/overview/LatestTransactions'
import { NeedsYouStrip } from '../components/overview/NeedsYouStrip'
import { OwnAndOwe } from '../components/overview/OwnAndOwe'
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
    <OverviewView
      chips={<PromptChips flow={flow.isError ? undefined : flow.data} ask={ask} />}
      needsYou={<NeedsYouStrip connections={connections} review={review} transfers={transfers} now={now} />}
      cashOnHand={<CashOnHand accounts={accounts} currency={currency} currencyKnown fresh={fresh} />}
      ownAndOwe={<OwnAndOwe accounts={accounts} connections={connections} currency={currency} currencyKnown now={now} />}
      latest={<LatestTransactions latest={latest} currency={currency} fresh={fresh} />}
      spendByMonth={<SpendByMonth flow={flow} review={review} fresh={fresh} />}
      whereItWent={<WhereItWent flow={flow} review={review} fresh={fresh} />}
    />
  )
}
