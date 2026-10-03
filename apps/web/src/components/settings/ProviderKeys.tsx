import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { errorMessage, sendJson, type ConnectionSummary } from '../../lib/api'
import { ENABLE_BANKING_AVAILABLE } from '../../lib/enable-banking'
import { formatLocalDate } from '../../lib/format'
import { providerCredentialsOptions, queryError } from '../../lib/queries'
import { Button } from '../ui/Button'
import { Field, Input } from '../ui/Field'
import { Notice } from '../ui/States'
import { CardHeader, TextButton } from './ui'

type CredentialField = { key: string; label: string; statusLabel: string; type?: string; help?: string }

type Provider = {
  id: ConnectionSummary['provider']
  title: string
  description: string
  fields: CredentialField[]
  disabled?: boolean
}

const PROVIDERS: Provider[] = [
  {
    id: 'enable-banking',
    title: 'Enable Banking',
    description: 'Needed to connect an EU (PSD2) bank. Get an application id and a private key from your Enable Banking Control Panel.',
    disabled: !ENABLE_BANKING_AVAILABLE,
    fields: [
      { key: 'appId', label: 'Application ID', statusLabel: 'Application ID' },
      {
        key: 'keyPath',
        label: 'Private key path',
        statusLabel: 'Private key file',
        help: "Absolute path to the .pem private key on the server's own filesystem — not the key's contents. Must be readable by the process running apps/server.",
      },
    ],
  },
  {
    id: 'plaid',
    title: 'Plaid',
    description: 'Needed to connect a US bank. Get a client id and secret from your Plaid dashboard.',
    fields: [
      { key: 'clientId', label: 'Client ID', statusLabel: 'Client ID' },
      { key: 'secret', label: 'Secret', statusLabel: 'Secret', type: 'password', help: 'Stored encrypted. Not shown again once saved.' },
    ],
  },
]

export function ProviderKeys({ connections }: { connections: ConnectionSummary[] }) {
  return (
    <section aria-label="Provider keys" className="@container rounded-lg border border-line bg-surface px-[18px] py-4 shadow-1">
      <CardHeader
        title="Provider keys"
        meta="Saved values are stored encrypted on your server and never shown again — you can only replace them. The Enable Banking private key stays a file on your server; only its path is saved."
      />
      <div className="mt-3 grid grid-cols-1 gap-3 @min-[760px]:grid-cols-2">
        {PROVIDERS.map((p) => {
          const banks = connections.filter((c) => c.provider === p.id && c.institutionName).map((c) => c.institutionName)
          return <ProviderBlock key={p.id} provider={p} banks={[...new Set(banks)].join(', ')} />
        })}
      </div>
    </section>
  )
}

function ProviderBlock({ provider, banks }: { provider: Provider; banks: string }) {
  const { id, title, description, fields, disabled = false } = provider
  const status = useQuery(providerCredentialsOptions(id))
  const emptyDraft = () => Object.fromEntries(fields.map((f) => [f.key, ''])) as Record<string, string>
  const [draft, setDraft] = useState<Record<string, string>>(emptyDraft)
  const [replacing, setReplacing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const block = useRef<HTMLDivElement>(null)
  const focusNext = useRef<'field' | 'replace' | null>(null)

  const configured = status.data?.configured === true
  const editing = status.data !== undefined && (!configured || replacing)
  const complete = fields.every((f) => draft[f.key]?.trim())

  useEffect(() => {
    const target = focusNext.current
    if (!target) return
    focusNext.current = null
    block.current?.querySelector<HTMLElement>(target === 'field' ? 'input' : '[data-replace]')?.focus()
  }, [editing])

  const update = (key: string, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setJustSaved(false)
    setServerError(null)
  }

  const replace = () => {
    focusNext.current = 'field'
    setReplacing(true)
  }

  const cancel = () => {
    focusNext.current = 'replace'
    setDraft(emptyDraft())
    setReplacing(false)
    setServerError(null)
  }

  const save = async () => {
    if (!complete) return
    setBusy(true)
    setServerError(null)
    try {
      await sendJson('PUT', `/api/settings/provider-credentials/${id}`, draft)
      focusNext.current = 'replace'
      setDraft(emptyDraft())
      setReplacing(false)
      setJustSaved(true)
      void status.refetch()
    } catch (e) {
      setServerError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const saved = status.data?.updatedAt ? `Configured · saved ${formatLocalDate(status.data.updatedAt)}` : 'Configured'

  return (
    <div ref={block} className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline gap-2 text-[13px] font-bold text-ink">
        <h4>{title}</h4>
        {banks && <small className="min-w-0 truncate text-[11.5px] font-medium text-ink-3">for {banks}</small>}
        {disabled ? (
          <span className="ml-auto text-[11.5px] font-medium whitespace-nowrap text-ink-3">Not available yet</span>
        ) : (
          <>
            {status.data && !configured && <span className="ml-auto text-[11.5px] font-medium whitespace-nowrap text-ink-3">Not configured</span>}
            {configured && !editing && (
              <TextButton data-replace className="ml-auto" onClick={replace}>
                Replace<span className="sr-only"> {title} keys</span>
              </TextButton>
            )}
          </>
        )}
      </div>
      {status.isError ? (
        <Notice tone="error">{queryError(status)}</Notice>
      ) : !status.data ? (
        <p className="text-[12px] text-ink-3">Loading…</p>
      ) : editing ? (
        <>
          <p className="max-w-prose text-[12px] leading-relaxed text-ink-3">{description}</p>
          {fields.map((f) => (
            <Field key={f.key} id={`${id}-${f.key}`} label={f.label} help={f.help}>
              <Input
                id={`${id}-${f.key}`}
                type={f.type ?? 'text'}
                autoComplete={f.type === 'password' ? 'new-password' : undefined}
                value={draft[f.key]}
                disabled={disabled}
                onChange={(e) => update(f.key, e.target.value)}
                aria-describedby={f.help ? `${id}-${f.key}-help` : undefined}
                className="max-w-md"
              />
            </Field>
          ))}
          {serverError && <Notice tone="error">{serverError}</Notice>}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="primary" busy={busy} disabled={disabled || !complete} onClick={() => void save()}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
            {configured && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={cancel}>
                Cancel
              </Button>
            )}
          </div>
        </>
      ) : (
        <>
          {fields.map((f) => (
            <div key={f.key} className="grid grid-cols-[118px_minmax(0,1fr)] items-center gap-2.5 text-[12px] text-ink-2">
              <span>{f.statusLabel}</span>
              <code className="truncate rounded-sm border border-line bg-surface-2 px-[9px] py-1.5 font-mono text-[12px] font-medium tracking-[0.04em] text-ink">
                {saved}
              </code>
            </div>
          ))}
          {justSaved && <Notice tone="success">Saved.</Notice>}
        </>
      )}
    </div>
  )
}
