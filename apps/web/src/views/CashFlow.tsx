import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'
import {
  CashFlowHero,
  CashFlowRow,
  CashFlowView,
  CF_HALVES,
  Controls,
  currentMonth,
  DailySpend,
  DrillContext,
  InOutRate,
  Merchants,
  monthLong,
  MonthByMonth,
  monthShortYear,
  monthStart,
  scopedConnections,
  type Drill,
} from '@repo/ui/cashflow'
import { Categories } from '../components/cashflow/Categories'
import { DrillDrawer } from '../components/cashflow/DrillDrawer'
import { Largest } from '../components/cashflow/Largest'
import { MoveTiles } from '../components/cashflow/MoveTiles'
import { NotCounted } from '../components/cashflow/NotCounted'
import { SankeyCard } from '../components/cashflow/SankeyCard'
import { Sources } from '../components/cashflow/Sources'
import { Transfers } from '../components/cashflow/Transfers'
import { TrustLine } from '../components/cashflow/TrustLine'
import { Empty, ErrorState, Loading } from '@repo/ui/primitives'
import type { CashFlowCompare, CashFlowParams } from '../lib/api'
import { useDisplayCurrency } from '../lib/app-context'
import { summarizeConnections } from '@repo/ui/connection-health'
import { cashFlowOptions, connectionsOptions, queryError } from '../lib/queries'

const route = getRouteApi('/currency/cashflow')

export function CashFlow() {
  const currency = useDisplayCurrency()
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const [drill, setDrill] = useState<Drill | null>(null)
  const [now] = useState(Date.now)

  const month = search.month ?? currentMonth()
  const { compare, accounts } = search
  const setSearch = (next: { month?: string; compare?: CashFlowCompare; accounts?: string[] }, replace = false) =>
    void navigate({ to: '/cashflow', search: (prev) => ({ ...prev, ...next }), replace, resetScroll: false })

  const params: CashFlowParams = { month, compare, accounts, currency }
  const flow = useQuery({ ...cashFlowOptions(params), placeholderData: keepPreviousData })
  const connections = useQuery(connectionsOptions())

  const data = flow.isError ? undefined : flow.data
  const accountNames =
    accounts.length === 0
      ? 'All accounts'
      : accounts.length === 1
        ? (data?.accounts.find((a) => a.id === accounts[0])?.name ?? '1 account')
        : `${accounts.length} accounts`
  // The drawer describes the figures on screen, which stay the previous response's while a new one loads.
  const drawerMonth = data ? `${monthShortYear.format(monthStart(data.month))}${data.partial ? ' to date' : ''}` : ''
  const health =
    data && !connections.isError && connections.data
      ? summarizeConnections(scopedConnections(data.accounts, accounts, connections.data), now)
      : null

  return (
    <DrillContext.Provider value={setDrill}>
      <CashFlowView
        busy={flow.isFetching}
        trustLine={data && health && <TrustLine data={data} attention={health.attention} connected={health.live.length} syncStamp={health.syncStamp} />}
        controls={
          <Controls
            month={month}
            onMonth={(m) => setSearch({ month: m })}
            compare={compare}
            onCompare={(c) => setSearch({ compare: c })}
            accounts={accounts}
            onAccounts={(ids) => setSearch({ accounts: ids }, true)}
            data={data}
            currency={currency}
          />
        }
      >
        {flow.isError ? (
          <ErrorState title="Couldn't load your cash flow" message={queryError(flow)} onRetry={() => void flow.refetch()} />
        ) : !data ? (
          <Loading label="Loading cash flow" rows={4} />
        ) : data.totals.moneyIn === 0 &&
          data.totals.moneyOut === 0 &&
          data.notCounted.length === 0 &&
          data.possibleTransfers.count === 0 ? (
          <div className="border-t border-line">
            <Empty title={`Nothing counted in ${monthLong.format(monthStart(data.month))}`}>
              No money came in or went out of these accounts this month. Pick another month or include more accounts.
            </Empty>
          </div>
        ) : (
          <>
            <CashFlowHero data={data} syncStamp={health?.syncStamp ?? null} />
            <CashFlowRow cols="min-[1200px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <InOutRate data={data} />
              <MonthByMonth data={data} onMonth={(m) => setSearch({ month: m })} />
            </CashFlowRow>
            <MoveTiles data={data} />
            <SankeyCard data={data} />
            <CashFlowRow cols="lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <Categories data={data} />
              <Merchants data={data} />
            </CashFlowRow>
            <div className={CF_HALVES}>
              <DailySpend data={data} />
              <NotCounted data={data} params={params} />
            </div>
            <CashFlowRow cols="lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] min-[110rem]:grid-cols-[minmax(0,1.3fr)_minmax(0,.85fr)_minmax(0,1.1fr)]">
              <Transfers data={data} />
              <Sources data={data} />
              <Largest data={data} className="lg:col-span-2 min-[110rem]:col-span-1" />
            </CashFlowRow>
          </>
        )}

        {drill && data && (
          <DrillDrawer
            key={drill.token}
            drill={drill}
            params={{ ...params, month: data.month, currency: data.currency }}
            title={`${drill.label} · ${drawerMonth} · ${accountNames}`}
            onClose={() => setDrill(null)}
          />
        )}
      </CashFlowView>
    </DrillContext.Provider>
  )
}
