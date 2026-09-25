import { useState } from 'react'
import { Button } from '../components/ui/Button'
import { Field, Input } from '../components/ui/Field'
import { ErrorState, Loading, Notice } from '../components/ui/States'
import { PageHeader, SectionTitle } from '../components/ui/Typography'
import { errorMessage, getJson, sendJson, type GateSettings, type ProviderCredentialsStatus } from '../lib/api'
import { formatTimestamp, toNumber } from '../lib/format'
import { useResource } from '../lib/useResource'

/** SOURCE OF TRUTH: the Settings screen — the confidence gate thresholds
 * plus the connector provider credentials (Plaid, Enable Banking).
 * WHAT: GET/PUT /api/settings/gate (gate thresholds — see GateForm) and
 * GET/PUT /api/settings/provider-credentials/:provider (ProviderCredentialsForm).
 * The server never returns saved credentials, only {configured, updatedAt}
 * — every save re-enters both fields from scratch, there is no partial
 * update or "leave blank to keep".
 * WHY: auto-categorization touches the ledger without asking — the person
 * must be able to see and tune exactly how cautious it is. Connecting a
 * bank needs Fluide's own API credentials for that provider first; this
 * is where they're entered, once, instead of an env var + server restart.
 * WHERE: forms only. Gate enforcement is categorization/gate.ts; credential
 * storage/encryption is apps/server's provider-credentials.ts + vault.ts.
 */

type Draft = { highConfidence: string; lowConfidence: string; minVendorOccurrences: string; amountRangeTolerance: string }
type Key = keyof Draft

const DEFAULTS: Draft = { highConfidence: '0.75', lowConfidence: '0.50', minVendorOccurrences: '3', amountRangeTolerance: '0.5' }

const FIELDS: { key: Key; label: string; step: string; min: string; max?: string; help: string }[] = [
  {
    key: 'highConfidence',
    label: 'Auto-apply threshold',
    step: '0.01',
    min: '0',
    max: '1',
    help: 'Model confidence (0–1) at or above which a suggestion may be applied without asking you — only if the vendor checks below also pass. Default 0.75.',
  },
  {
    key: 'lowConfidence',
    label: 'Suggestion threshold',
    step: '0.01',
    min: '0',
    max: '1',
    help: 'Below this confidence no category is suggested; the transaction goes to Review uncategorized. Between this and the auto-apply threshold, the suggestion waits for your approval. Must be lower than the auto-apply threshold. Default 0.50.',
  },
  {
    key: 'minVendorOccurrences',
    label: 'Vendor history required',
    step: '1',
    min: '1',
    help: 'How many earlier transactions from the same vendor must already carry that category before anything auto-applies. A whole number, at least 1. Default 3.',
  },
  {
    key: 'amountRangeTolerance',
    label: 'Amount tolerance',
    step: '0.05',
    min: '0',
    max: '999',
    help: 'How far outside a vendor’s usual amounts a new charge may fall and still auto-apply, as a fraction of its largest past amount — 0.5 allows up to 50% beyond. Unusual amounts go to Review. Default 0.5.',
  },
]

function toDraft(s: GateSettings): Draft {
  return {
    highConfidence: String(toNumber(s.highConfidence)),
    lowConfidence: String(toNumber(s.lowConfidence)),
    minVendorOccurrences: String(toNumber(s.minVendorOccurrences)),
    amountRangeTolerance: String(toNumber(s.amountRangeTolerance)),
  }
}

function validate(d: Draft): Partial<Record<Key, string>> {
  const errors: Partial<Record<Key, string>> = {}
  const n = (k: Key) => (d[k].trim() === '' ? Number.NaN : Number(d[k]))
  const high = n('highConfidence')
  const low = n('lowConfidence')
  const min = n('minVendorOccurrences')
  const tol = n('amountRangeTolerance')
  if (!Number.isFinite(high) || high < 0 || high > 1) errors.highConfidence = 'Enter a number from 0 to 1.'
  if (!Number.isFinite(low) || low < 0 || low > 1) errors.lowConfidence = 'Enter a number from 0 to 1.'
  else if (Number.isFinite(high) && low >= high) errors.lowConfidence = 'Must be lower than the auto-apply threshold.'
  if (!Number.isInteger(min) || min < 1) errors.minVendorOccurrences = 'Enter a whole number of at least 1.'
  if (!Number.isFinite(tol) || tol < 0 || tol > 999) errors.amountRangeTolerance = 'Enter a number from 0 to 999.'
  return errors
}

export function Settings() {
  const settings = useResource((signal) => getJson<{ settings: GateSettings }>('/api/settings/gate', signal).then((r) => r.settings))

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        eyebrow="Configuration"
        title="Settings"
        lede="How cautious Fluide is when it categorizes transactions on its own, and which connector providers it can reach."
      />
      {settings.error ? (
        <ErrorState title="Couldn't load the gate settings" message={settings.error} onRetry={settings.reload} />
      ) : !settings.data ? (
        <Loading label="Loading settings" rows={4} />
      ) : (
        <GateForm initial={settings.data} />
      )}
      <ProviderCredentialsForm
        provider="plaid"
        title="Plaid credentials"
        description="Needed to connect a US/CA sandbox bank. Get a client id and secret from your Plaid dashboard."
        fields={[
          { key: 'clientId', label: 'Client ID' },
          { key: 'secret', label: 'Secret', type: 'password', help: 'Stored encrypted. Not shown again once saved.' },
        ]}
      />
      <ProviderCredentialsForm
        provider="enable-banking"
        title="Enable Banking credentials"
        description="Needed to connect an EU (PSD2) bank. Get an application id and a private key from your Enable Banking Control Panel."
        fields={[
          { key: 'appId', label: 'Application ID' },
          {
            key: 'keyPath',
            label: 'Private key path',
            help: "Absolute path to the .pem private key on the server's own filesystem — not the key's contents. Must be readable by the process running apps/server.",
          },
        ]}
      />
    </div>
  )
}

function GateForm({ initial }: { initial: GateSettings }) {
  const [saved, setSaved] = useState<GateSettings>(initial)
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial))
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  const errors = validate(draft)
  const invalid = Object.keys(errors).length > 0
  const dirty = (Object.keys(draft) as Key[]).some((k) => Number(draft[k]) !== toNumber(saved[k]))

  const update = (k: Key, v: string) => {
    setDraft((d) => ({ ...d, [k]: v }))
    setTouched(true)
    setJustSaved(false)
    setServerError(null)
  }

  const save = async () => {
    setTouched(true)
    if (invalid) return
    setBusy(true)
    setServerError(null)
    try {
      const { settings } = await sendJson<{ settings: GateSettings }>('PUT', '/api/settings/gate', {
        highConfidence: Number(draft.highConfidence),
        lowConfidence: Number(draft.lowConfidence),
        minVendorOccurrences: Number(draft.minVendorOccurrences),
        amountRangeTolerance: Number(draft.amountRangeTolerance),
      })
      setSaved(settings)
      setDraft(toDraft(settings))
      setTouched(false)
      setJustSaved(true)
    } catch (e) {
      setServerError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
      <form
        noValidate
        className="flex flex-col gap-7 lg:col-span-7"
        onSubmit={(e) => {
          e.preventDefault()
          void save()
        }}
      >
        <SectionTitle aside={saved.updatedAt ? `Last saved ${formatTimestamp(saved.updatedAt)}` : 'Using defaults'}>
          Confidence gate
        </SectionTitle>
        {FIELDS.map((f) => {
          const error = touched ? errors[f.key] : undefined
          return (
            <Field key={f.key} id={`gate-${f.key}`} label={f.label} help={f.help} error={error}>
              <Input
                id={`gate-${f.key}`}
                type="number"
                inputMode="decimal"
                step={f.step}
                min={f.min}
                max={f.max}
                value={draft[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
                aria-invalid={!!error}
                aria-describedby={`gate-${f.key}-help gate-${f.key}-error`}
                className="figures max-w-40"
              />
            </Field>
          )
        })}

        <div className="flex flex-col gap-3 border-t border-rule pt-5">
          {serverError && <Notice tone="error">The server rejected these settings: {serverError}</Notice>}
          {justSaved && <Notice tone="success">Saved. The next categorization run uses these thresholds.</Notice>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" busy={busy} disabled={!dirty || (touched && invalid)}>
              {busy ? 'Saving…' : 'Save settings'}
            </Button>
            <Button onClick={() => { setDraft(toDraft(saved)); setTouched(false); setServerError(null) }} disabled={!dirty || busy}>
              Discard changes
            </Button>
            <Button variant="ghost" onClick={() => { setDraft(DEFAULTS); setTouched(true); setJustSaved(false) }} disabled={busy}>
              Restore defaults
            </Button>
          </div>
        </div>
      </form>

      <aside className="lg:col-span-5">
        <SectionTitle>What the gate does</SectionTitle>
        <GateDiagram low={Number(draft.lowConfidence)} high={Number(draft.highConfidence)} />
        <p className="mt-5 text-[14px] leading-relaxed text-ink-2">
          Rules you've activated always run first. For everything else the Jev model proposes a category with a
          confidence score, and the gate decides what happens next. Even above the auto-apply threshold, a category is
          only applied if the vendor has enough history and the amount looks normal — otherwise it waits in Review.
        </p>
      </aside>
    </div>
  )
}

function GateDiagram({ low, high }: { low: number; high: number }) {
  const ok = Number.isFinite(low) && Number.isFinite(high) && low >= 0 && low < high && high <= 1
  const l = ok ? low * 100 : 50
  const h = ok ? high * 100 : 75
  const bands = [
    { label: 'No suggestion', width: l, className: 'bg-red-wash text-red' },
    { label: 'Review', width: h - l, className: 'bg-amber-wash text-amber' },
    { label: 'May auto-apply', width: 100 - h, className: 'bg-green-wash text-green-deep' },
  ]
  return (
    <figure className="pt-2">
      <div className="flex h-9 overflow-hidden rounded-[2px] border border-rule text-[11px] font-medium" aria-hidden>
        {bands.map((b) => (
          <div
            key={b.label}
            style={{ width: `${b.width}%` }}
            className={`flex items-center justify-center overflow-hidden px-1 whitespace-nowrap transition-[width] ${b.className}`}
          >
            {b.width >= 14 ? b.label : ''}
          </div>
        ))}
      </div>
      <div className="figures relative mt-1.5 h-4 text-[11px] text-ink-3" aria-hidden>
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${l}%` }}>
          {ok ? low.toFixed(2) : '—'}
        </span>
        <span className="absolute -translate-x-1/2" style={{ left: `${h}%` }}>
          {ok ? high.toFixed(2) : '—'}
        </span>
        <span className="absolute right-0">1</span>
      </div>
      <figcaption className="mt-3 text-[13px] text-ink-3">
        {ok
          ? `Below ${low.toFixed(2)}: no suggestion. ${low.toFixed(2)}–${high.toFixed(2)}: you review. ${high.toFixed(2)} and above: may auto-apply.`
          : 'Fix the thresholds to preview the bands.'}
      </figcaption>
    </figure>
  )
}

type CredentialField = { key: string; label: string; type?: string; help?: string }

function ProviderCredentialsForm({
  provider,
  title,
  description,
  fields,
}: {
  provider: 'plaid' | 'enable-banking'
  title: string
  description: string
  fields: CredentialField[]
}) {
  const status = useResource((signal) =>
    getJson<ProviderCredentialsStatus>(`/api/settings/provider-credentials/${provider}`, signal),
  )
  const emptyDraft = () => Object.fromEntries(fields.map((f) => [f.key, ''])) as Record<string, string>
  const [draft, setDraft] = useState<Record<string, string>>(emptyDraft)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  const complete = fields.every((f) => draft[f.key]?.trim())

  const update = (key: string, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setJustSaved(false)
    setServerError(null)
  }

  const save = async () => {
    if (!complete) return
    setBusy(true)
    setServerError(null)
    try {
      await sendJson('PUT', `/api/settings/provider-credentials/${provider}`, draft)
      setDraft(emptyDraft())
      setJustSaved(true)
      status.reload()
    } catch (e) {
      setServerError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 border-t border-rule pt-7">
      <SectionTitle
        aside={
          status.data
            ? status.data.configured
              ? `Configured${status.data.updatedAt ? ` · saved ${formatTimestamp(status.data.updatedAt)}` : ''}`
              : 'Not configured'
            : undefined
        }
      >
        {title}
      </SectionTitle>
      <p className="max-w-prose text-[13px] leading-relaxed text-ink-3">{description}</p>
      {fields.map((f) => (
        <Field key={f.key} id={`${provider}-${f.key}`} label={f.label} help={f.help}>
          <Input
            id={`${provider}-${f.key}`}
            type={f.type ?? 'text'}
            value={draft[f.key]}
            onChange={(e) => update(f.key, e.target.value)}
            className="max-w-md"
          />
        </Field>
      ))}
      {serverError && <Notice tone="error">{serverError}</Notice>}
      {justSaved && <Notice tone="success">Saved.</Notice>}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" busy={busy} disabled={!complete} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

