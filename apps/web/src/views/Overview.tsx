import { useState } from 'react'
import { currentMonth } from '../components/cashflow/figures'
import { CashOnHand } from '../components/overview/CashOnHand'
import { ConnectFirst } from '../components/overview/ConnectFirst'
import { loadLatest } from '../components/overview/data'
import { LatestTransactions } from '../components/overview/LatestTransactions'
import { freshness } from '../components/overview/model'
import { NeedsYouStrip } from '../components/overview/NeedsYouStrip'
import { OwnAndOwe } from '../components/overview/OwnAndOwe'
import { PromptChips } from '../components/overview/PromptChips'
import { SpendByMonth } from '../components/overview/SpendByMonth'
import { WhereItWent } from '../components/overview/WhereItWent'
import { usePossibleTransfers } from '../components/review/data'
import { getCashFlow, getJson, type AccountBalance, type ConnectionSummary, type ReviewItem } from '../lib/api'
import { useApp } from '../lib/app-context'
import { useResource } from '../lib/useResource'

export function Overview() {
  const { version, invalidate, navigate, ask } = useApp()
  const [now] = useState(Date.now)
  const [month] = useState(currentMonth)

  const flow = useResource((signal) => getCashFlow({ month, compare: 'average', accounts: [], currency: 'USD' }, signal), version)
  const accounts = useResource(
    (signal) => getJson<{ accounts: AccountBalance[] }>('/api/ledger/account-balances', signal).then((r) => r.accounts),
    version,
  )
  const connections = useResource(
    (signal) => getJson<{ connections: ConnectionSummary[] }>('/api/providers/connections', signal).then((r) => r.connections),
    version,
  )
  const review = useResource((signal) => getJson<{ items: ReviewItem[] }>('/api/assistant/review-queue', signal).then((r) => r.items), version)
  const transfers = usePossibleTransfers(version)
  const latest = useResource(loadLatest, version)

  if (accounts.data?.length === 0) return <ConnectFirst onConnected={invalidate} />

  const fresh = freshness(accounts.data, connections.data, now)

  return (
    <div className="flex flex-col gap-5">
      <PromptChips flow={flow.data} ask={ask} />
      <NeedsYouStrip connections={connections} review={review} transfers={transfers} now={now} navigate={navigate} />
      <div className="grid grid-cols-1 items-start gap-4 min-[1280px]:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <CashOnHand accounts={accounts} currency="USD" currencyKnown fresh={fresh} navigate={navigate} />
          <OwnAndOwe accounts={accounts} connections={connections} currency="USD" currencyKnown now={now} navigate={navigate} />
          <LatestTransactions latest={latest} currency="USD" fresh={fresh} navigate={navigate} />
        </div>
        <div className="mx-auto flex w-full min-w-0 max-w-[480px] flex-col gap-4 min-[1280px]:max-w-none">
          <SpendByMonth flow={flow} review={review} fresh={fresh} />
          <WhereItWent flow={flow} review={review} fresh={fresh} navigate={navigate} />
        </div>
      </div>
    </div>
  )
}
