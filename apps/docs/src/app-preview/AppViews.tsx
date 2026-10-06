import { Fragment, useRef } from 'react'
import { AccountsView, BalanceSheet, DataAge, isLive, NeedsYouView, NetWorthCard, OweCard } from '@repo/ui/accounts'
import { AskCard, AssistantTrustLine, AssistantView, Conversation } from '@repo/ui/assistant'
import { CashFlowHero, CashFlowRow, CashFlowTrustLine, CashFlowView, Controls, InOutRate, MonthByMonth, scopedConnections } from '@repo/ui/cashflow'
import { shortName, summarizeConnections } from '@repo/ui/connection-health'
import { toNumber } from '@repo/ui/format'
import {
  CashOnHandCard,
  LatestTransactionsCard,
  NeedsYouStripView,
  OverviewView,
  OwnAndOweCard,
  PromptChips,
  SpendByMonthCard,
  WhereItWentCard,
} from '@repo/ui/overview'
import { Button, Segmented, Select } from '@repo/ui/primitives'
import {
  AfterDecide,
  AtStake,
  ConfidenceSplit,
  itemAmount,
  QueueCard,
  ReviewHero,
  ReviewTrustLine,
  ReviewView,
  TransferCard,
} from '@repo/ui/review'
import {
  CategorizeGlyph,
  DayHeading,
  DayTotal,
  dayTotals,
  groupByDay,
  groupByMonth,
  LedgerColumns,
  MonthDivider,
  MonthFlowSummary,
  MonthTotalsCard,
  SyncGlyph,
  TransactionRow,
  TransactionsView,
  WaitingStrip,
} from '@repo/ui/transactions'
import type { LedgerRow } from '@repo/ui/types'
import { noop } from '../lib/noop'
import {
  accountBalances,
  assistantTrustProps,
  bandCounts,
  cashflow,
  cashOnHandProps,
  connections,
  connectionSummary,
  CURRENCY,
  fresh,
  gateBounds,
  latest,
  mainTotals,
  needsYouProps,
  NOW,
  ownAndOweProps,
  queueCardProps,
  reviewQueue,
  reviewTiles,
  stake,
  threads,
  transactionCount,
  transactions,
  transfers,
  uncategorizedCount,
} from './sample'

/* The six app views the landing shows, composed from @repo/ui exactly as apps/web's views compose them
   (apps/web/src/views/*.tsx), fed from ../sample instead of queries, in their first state (no filter, no
   drawer, no conversation). Navigation and actions are no-ops: the window is a picture. The window crops
   each view, so Cash flow stops after its In/out + Month-by-month row. */

export const VIEWS = ['overview', 'transactions', 'accounts', 'cashflow', 'review', 'assistant'] as const
export type View = (typeof VIEWS)[number]

/** View → sidebar route (`NAV[].to`), the header's subtitle key. */
export const VIEW_ROUTE: Record<View, string> = {
  overview: '/',
  transactions: '/transactions',
  accounts: '/accounts',
  cashflow: '/cashflow',
  review: '/review',
  assistant: '/assistant',
}

export function OverviewDemo() {
  return (
    <OverviewView
      chips={<PromptChips flow={cashflow} ask={noop} />}
      needsYou={
        <div data-slot="needsYou">
          <NeedsYouStripView {...needsYouProps} onSettings={noop} onReview={noop} />
        </div>
      }
      cashOnHand={
        <div data-slot="cashOnHand">
          <CashOnHandCard {...cashOnHandProps} onOpenAccounts={noop} />
        </div>
      }
      ownAndOwe={
        <div data-slot="ownOwe">
          <OwnAndOweCard {...ownAndOweProps} onOpenAccounts={noop} />
        </div>
      }
      latest={
        <div data-slot="latestRows">
          <LatestTransactionsCard data={latest} currency={CURRENCY} fresh={fresh} onOpen={noop} />
        </div>
      }
      spendByMonth={
        <div data-slot="spendByMonth">
          <SpendByMonthCard flow={cashflow} items={reviewQueue} fresh={fresh} />
        </div>
      }
      whereItWent={
        <div data-slot="whereItWent">
          <WhereItWentCard flow={cashflow} items={reviewQueue} fresh={fresh} onDetails={noop} onReview={noop} />
        </div>
      }
    />
  )
}

const LIMIT = 50

type Row = LedgerRow & { key: string; accountName: string; merchant: string }

const rows: Row[] = transactions.map((row) => ({
  ...row,
  key: row.posting.id ?? `${row.id}:${row.posting.accountId}`,
  accountName: row.account?.name ?? 'Unknown account',
  merchant: row.posting.counterpartyRaw || row.description,
}))

/** apps/web views/Transactions.tsx: no search, all categories, the first page of the ledger. */
export function TransactionsDemo() {
  const days = dayTotals(rows)
  const waitingTotals: Record<string, number> = {}
  for (const item of reviewQueue) {
    if (item.posting) waitingTotals[item.posting.currency] = (waitingTotals[item.posting.currency] ?? 0) + Math.abs(toNumber(item.posting.amount))
  }
  const categoryOptions: Record<string, string> = {}
  for (const r of rows) if (r.posting.categoryId && r.category?.label) categoryOptions[r.posting.categoryId] = r.category.label

  return (
    <TransactionsView
      count={transactionCount}
      search={{ value: '', onChange: noop }}
      shown={{ visible: transactionCount, total: transactionCount }}
      waiting={
        <WaitingStrip count={reviewQueue.length} totals={Object.entries(waitingTotals).map(([currency, total]) => ({ currency, total }))}>
          <Button variant="primary" size="sm">
            Review {reviewQueue.length}
          </Button>
        </WaitingStrip>
      }
      monthCard={
        <MonthTotalsCard
          month={cashflow.month}
          currency={cashflow.currency}
          moneyOut={cashflow.totals.moneyOut}
          moneyIn={cashflow.totals.moneyIn}
          kept={cashflow.totals.kept}
        />
      }
      actions={
        <>
          <Button size="sm">
            <SyncGlyph />
            Sync
          </Button>
          <Button variant="primary" size="sm">
            <CategorizeGlyph />
            Run categorization
            {uncategorizedCount > 0 && <small className="hidden text-[11px] font-medium opacity-[.65] min-[1360px]:inline-block">{uncategorizedCount} uncategorized</small>}
          </Button>
        </>
      }
      filter={
        <Select aria-label="Filter by category" pill value="" onChange={noop} className="w-auto sm:w-[150px]">
          <option value="">All categories</option>
          <option value="__uncategorized">Uncategorized{uncategorizedCount ? ` (${uncategorizedCount})` : ''}</option>
          {Object.entries(categoryOptions)
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
        </Select>
      }
    >
      <LedgerColumns />
      {groupByMonth(rows).map((g) => {
        const flow = cashflow.months.find((m) => m.month === g.month)
        return (
          <Fragment key={g.month}>
            <MonthDivider label={g.label}>
              {flow ? (
                <MonthFlowSummary moneyIn={flow.moneyIn} moneyOut={flow.moneyOut} net={flow.net} currency={cashflow.currency} />
              ) : (
                <span className="ml-auto text-[12px] text-ink-3">
                  {g.rows.length} row{g.rows.length !== 1 ? 's' : ''}
                </span>
              )}
            </MonthDivider>
            {groupByDay(g.rows).map((d) => (
              <Fragment key={d.date}>
                <DayHeading group={d} count={days[d.date].count}>
                  <DayTotal info={days[d.date]} />
                </DayHeading>
                {d.rows.map((r) => (
                  <TransactionRow key={r.key} row={r} onClick={noop} mainCurrency={cashflow.currency} />
                ))}
              </Fragment>
            ))}
          </Fragment>
        )
      })}
      <div className="border-t border-line p-[14px] text-center text-[12.5px] text-ink-2">
        Latest {LIMIT} rows ·{' '}
        <button type="button" className="border-b border-line-strong pb-[1px] font-semibold text-ink hover:border-ink">
          Show {Math.min(LIMIT, transactionCount - LIMIT)} more
        </button>
      </div>
    </TransactionsView>
  )
}

/** apps/web views/Accounts.tsx (AccountsBody); Reconnect is ConnectionAction's Plaid trigger, inert here. */
export function AccountsDemo() {
  const live = accountBalances.filter(isLive)
  return (
    <AccountsView
      needsYou={
        <NeedsYouView
          connections={connections}
          error={null}
          now={NOW}
          onSettings={noop}
          renderAction={(c, health) =>
            health.actions.reconnect && (
              <Button size="sm" variant={health.severity === 'broken' ? 'danger' : 'secondary'}>
                {health.actions.reconnect} {shortName(c.institutionName ?? 'bank')}
              </Button>
            )
          }
        />
      }
      netWorth={mainTotals && <NetWorthCard totals={mainTotals} uncounted={live.filter((a) => !a.countsTowardTotals).length} stamp={connectionSummary.syncStamp} />}
      owe={mainTotals && mainTotals.owed > 0 && <OweCard totals={mainTotals} accounts={live} />}
      dataAge={connectionSummary.live.length > 0 && <DataAge connections={connectionSummary.live} stamp={connectionSummary.syncStamp} now={NOW} />}
      balanceSheet={
        <BalanceSheet accounts={live} connections={connections} main={CURRENCY} mainTotals={mainTotals} now={NOW} onOpen={noop} onAddBank={noop} />
      }
    />
  )
}

/** apps/web views/CashFlow.tsx: this month, against the average, all accounts. */
export function CashFlowDemo() {
  const health = summarizeConnections(scopedConnections(cashflow.accounts, [], connections), NOW)
  return (
    <CashFlowView
      trustLine={
        <CashFlowTrustLine
          data={cashflow}
          attention={health.attention}
          connected={health.live.length}
          syncStamp={health.syncStamp}
          reviewCount={reviewQueue.length}
          onSettings={noop}
          onReview={noop}
        />
      }
      controls={
        <Controls
          month={cashflow.month}
          onMonth={noop}
          compare="average"
          onCompare={noop}
          accounts={[]}
          onAccounts={noop}
          data={cashflow}
          currency={CURRENCY}
          now={NOW}
        />
      }
    >
      <CashFlowHero data={cashflow} syncStamp={health.syncStamp} />
      <CashFlowRow cols="min-[1200px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <InOutRate data={cashflow} />
        <MonthByMonth data={cashflow} onMonth={noop} />
      </CashFlowRow>
    </CashFlowView>
  )
}

/** apps/web views/Review.tsx, filter "all", largest amount first. */
export function ReviewDemo() {
  const visible = [...reviewQueue].sort((a, b) => Math.abs(itemAmount(b)) - Math.abs(itemAmount(a)))
  return (
    <ReviewView
      hero={<ReviewHero count={reviewQueue.length} stake={stake} high={gateBounds.high} />}
      trustLine={<ReviewTrustLine count={reviewQueue.length} stake={stake} transfers={transfers} connections={connections} now={NOW} />}
      aside={
        <>
          {reviewTiles && <AtStake tiles={reviewTiles} />}
          <TransferCard groups={transfers} disabled={false} pendingKey={null} error={null} onDecide={noop} />
          <AfterDecide />
        </>
      }
    >
      <ConfidenceSplit counts={bandCounts} bounds={gateBounds} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[17px] font-bold text-ink outline-none">
          Waiting <span className="font-normal text-ink-3">· largest amount first</span>
        </h2>
        <Segmented
          label="Filter by confidence"
          value="all"
          onChange={noop}
          options={[
            { value: 'all', label: `All ${reviewQueue.length}` },
            { value: 'high', label: `High ${bandCounts.high}` },
            { value: 'medium', label: `Medium ${bandCounts.medium}` },
            { value: 'low', label: `Low ${bandCounts.low}` },
          ]}
        />
      </div>
      <div className="flex flex-col gap-3">
        {visible.map((item) => (
          <QueueCard key={item.id} {...queueCardProps(item)} />
        ))}
      </div>
    </ReviewView>
  )
}

/** apps/web views/Assistant.tsx before the first question: trust line, ask card, past conversations. */
export function AssistantDemo() {
  const askRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const latestRef = useRef<HTMLDivElement>(null)
  const followUpRef = useRef<HTMLTextAreaElement>(null)
  return (
    <AssistantView
      trustLine={<AssistantTrustLine {...assistantTrustProps} onSettings={noop} onReview={noop} />}
      askCard={<AskCard loading={false} inputRef={askRef} onSend={noop} />}
      conversation={
        <Conversation
          turns={[]}
          loading={false}
          threads={threads}
          historyOpen
          history={{ currentId: '', opening: null, locked: false, onOpen: noop, onDelete: noop, onClearAll: noop, now: NOW }}
          error={null}
          panelRef={panelRef}
          latestRef={latestRef}
          inputRef={followUpRef}
          onToggleHistory={noop}
          onSend={noop}
          onReset={noop}
        />
      }
    />
  )
}

export const VIEW_COMPONENT: Record<View, () => React.JSX.Element> = {
  overview: OverviewDemo,
  transactions: TransactionsDemo,
  accounts: AccountsDemo,
  cashflow: CashFlowDemo,
  review: ReviewDemo,
  assistant: AssistantDemo,
}
