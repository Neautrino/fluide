import { useState } from 'react'
import { errorMessage, getJson, putGeneralSettings, type AccountBalance } from '../../lib/api'
import { useApp } from '../../lib/app-context'
import { useResource } from '../../lib/useResource'
import { isLive } from '../accounts/model'
import { Segmented } from '../ui/Segmented'
import { ErrorState, Loading } from '../ui/States'
import { CardHeader, Stamp } from './ui'

const CURRENCIES = ['USD', 'EUR', 'INR'] as const
type Currency = (typeof CURRENCIES)[number]

type Status = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string }

export function GeneralCard() {
  const { settings, version, invalidate } = useApp()
  const accounts = useResource(
    (signal) => getJson<{ accounts: AccountBalance[] }>('/api/ledger/account-balances', signal).then((r) => r.accounts),
    version,
  )
  const [pending, setPending] = useState<Currency | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const select = async (next: Currency) => {
    setPending(next)
    setStatus({ kind: 'saving' })
    try {
      await putGeneralSettings({ displayCurrency: next })
      setStatus({ kind: 'saved' })
      invalidate()
    } catch (e) {
      setPending(null)
      setStatus({ kind: 'error', message: errorMessage(e) })
    }
  }

  const current = pending ?? settings.data?.displayCurrency
  const hasAccounts = accounts.data?.some((a) => isLive(a) && a.currency === current)

  return (
    <section id="general" className="scroll-mt-6 rounded-lg border border-line bg-surface px-[18px] py-4 shadow-1">
      {settings.error ? (
        <ErrorState title="Couldn't load the general settings" message={settings.error} onRetry={settings.reload} />
      ) : !settings.data || !current ? (
        <Loading label="Loading settings" rows={2} />
      ) : (
        <>
          <CardHeader
            title="General"
            aside={
              status.kind === 'saving' ? (
                <span className="text-[11.5px] text-ink-3">Saving…</span>
              ) : status.kind === 'saved' ? (
                <Stamp>Saved</Stamp>
              ) : null
            }
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="text-[13px] font-semibold text-ink">Currency</span>
            <Segmented<Currency>
              label="Currency"
              value={current as Currency}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              onChange={(c) => {
                if (c !== current) void select(c)
              }}
            />
          </div>
          <p className="mt-2.5 text-[12px] leading-normal text-ink-3">
            Pages show accounts and transactions in this currency only. Fluide never converts between currencies.
          </p>
          {accounts.data && !hasAccounts && (
            <p role="status" className="mt-1.5 text-[12px] leading-normal text-ink-2">
              No accounts in {current} yet, so pages will be empty.
            </p>
          )}
          {status.kind === 'error' && (
            <p role="alert" className="mt-1.5 text-[12px] leading-normal text-broken">
              Couldn't save: {status.message}
            </p>
          )}
        </>
      )}
    </section>
  )
}
