import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { errorMessage, putGeneralSettings } from '../../lib/api'
import { accountBalancesOptions, generalSettingsOptions, queryError, versionInfoOptions } from '../../lib/queries'
import { isLive } from '../accounts/model'
import { Segmented } from '../ui/Segmented'
import { ErrorState, Loading } from '../ui/States'
import { CardHeader, Stamp, TextButton } from './ui'

const CURRENCIES = ['USD', 'EUR', 'INR'] as const
type Currency = (typeof CURRENCIES)[number]

type Status = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved' } | { kind: 'error'; message: string }

const UPDATE_COMMAND = 'git pull && docker compose up -d --build'

export function GeneralCard() {
  const queryClient = useQueryClient()
  const settings = useQuery(generalSettingsOptions())
  const accounts = useQuery(accountBalancesOptions())
  const [pending, setPending] = useState<Currency | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const select = async (next: Currency) => {
    setPending(next)
    setStatus({ kind: 'saving' })
    try {
      await putGeneralSettings({ displayCurrency: next })
      setStatus({ kind: 'saved' })
      void queryClient.invalidateQueries()
    } catch (e) {
      setPending(null)
      setStatus({ kind: 'error', message: errorMessage(e) })
    }
  }

  const current = pending ?? (settings.isError ? undefined : settings.data?.displayCurrency)
  const balances = accounts.isError ? undefined : accounts.data
  const hasAccounts = balances?.some((a) => isLive(a) && a.currency === current)

  return (
    <section id="general" className="scroll-mt-6 rounded-lg border border-line bg-surface px-[18px] py-4 shadow-1">
      {settings.isError ? (
        <ErrorState title="Couldn't load the general settings" message={queryError(settings)} onRetry={() => void settings.refetch()} />
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
          {balances && !hasAccounts && (
            <p role="status" className="mt-1.5 text-[12px] leading-normal text-ink-2">
              No accounts in {current} yet, so pages will be empty.
            </p>
          )}
          {status.kind === 'error' && (
            <p role="alert" className="mt-1.5 text-[12px] leading-normal text-broken">
              Couldn't save: {status.message}
            </p>
          )}
          <VersionRow />
        </>
      )}
    </section>
  )
}

function VersionRow() {
  const info = useQuery(versionInfoOptions())
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = () => {
    navigator.clipboard.writeText(UPDATE_COMMAND).then(
      () => setCopied(true),
      () => setCopied(false),
    )
  }

  const data = info.isError ? undefined : info.data
  const latest = data?.updateAvailable ? data.latest : null
  const statusText = info.isError
    ? 'Could not check for updates'
    : !data
      ? 'Checking for updates…'
      : data.status === 'disabled'
        ? 'Update check is off (FLUIDE_UPDATE_CHECK=off)'
        : data.status === 'no-release'
          ? 'No release published yet'
          : data.status === 'unavailable'
            ? 'Could not check for updates'
            : latest
              ? `Update available: v${latest.version}`
              : 'Up to date'

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] font-semibold text-ink">Version</span>
        {data && <span className="figures font-mono text-[12.5px] font-medium text-ink-2">{data.current}</span>}
        <span role="status" className={`text-[12px] ${latest ? 'font-semibold text-ink' : 'text-ink-3'}`}>
          {statusText}
        </span>
        {latest && (
          <a
            href={latest.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] whitespace-nowrap text-ink-3 hover:text-ink"
          >
            Release notes ›
          </a>
        )}
      </div>
      {latest && (
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          <code className="truncate rounded-sm border border-line bg-surface-2 px-[9px] py-1.5 font-mono text-[12px] font-medium text-ink">
            {UPDATE_COMMAND}
          </code>
          <TextButton onClick={copy}>{copied ? 'Copied' : 'Copy'}</TextButton>
        </div>
      )}
    </div>
  )
}
