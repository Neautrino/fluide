import type { BalanceFlag, SyncOutcome } from '../lib/api'
import { Notice } from './ui/States'

const FLAG_TEXT: Record<BalanceFlag['issue'], string> = {
  no_bank_balance: 'the bank sent no balance, so it is not reconciled',
  fallback_type: 'the bank only sent an estimated balance, so it is not reconciled',
  currency_mismatch: 'the bank balance is in a different currency than the account',
  history_pending: 'history is still loading; it is reconciled on a later sync',
  no_transactions: 'no transactions yet, so it is not reconciled',
  pending_rows: 'reconciled once its pending transactions settle',
}

function outcomeLines(outcome: SyncOutcome): string[] {
  const name = outcome.institutionName ?? 'Bank connection'
  if (!outcome.ok) {
    const hint = outcome.status === 'reauth_required' ? ' Reconnect it in Settings › Bank connections.' : ''
    return [`${name}: ${outcome.error}.${hint}`]
  }
  const r = outcome.ingest
  const counts = [
    r.transactionsInserted && `${r.transactionsInserted} new`,
    r.transactionsUpdated && `${r.transactionsUpdated} updated`,
    r.transactionsVoided && `${r.transactionsVoided} voided`,
  ].filter(Boolean)
  const lines = [`${name}: ${counts.length ? counts.join(', ') : 'up to date'}.`]
  if (r.transactionsUnknownAccount) {
    lines.push(`${r.transactionsUnknownAccount} transaction(s) belong to an account the bank did not list; the next sync retries them.`)
  }
  for (const f of r.balanceFlags) lines.push(`${f.account}: ${FLAG_TEXT[f.issue]}.`)
  if (r.unclassifiedAccounts.length) {
    lines.push(`${r.unclassifiedAccounts.join(', ')}: account type not recognised, counted as other assets.`)
  }
  return lines
}

export function SyncNotice({ outcomes }: { outcomes: SyncOutcome[] }) {
  const failed = outcomes.filter((o) => !o.ok).length
  return (
    <Notice tone={failed ? 'error' : 'success'}>
      <ul className="flex flex-col gap-0.5">
        {outcomes.flatMap((o) => outcomeLines(o).map((line, i) => <li key={`${o.connectionId}:${i}`}>{line}</li>))}
      </ul>
    </Notice>
  )
}
