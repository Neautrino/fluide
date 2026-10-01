import { useEffect, useRef, useState } from 'react'
import {
  errorMessage,
  getJson,
  sendJson,
  type AiCredentialStatus,
  type AiDraft,
  type AiKeyChoice,
  type AiPreset,
  type AiProvider,
  type AiRole,
  type AiRoleStatus,
  type AiState,
  type AiTestResult,
} from '../../lib/api'
import { formatLocalDate, formatTimestamp } from '../../lib/format'
import { useResource } from '../../lib/useResource'
import { Button } from '../ui/Button'
import { Field, Input } from '../ui/Field'
import { ErrorState, Loading, Notice } from '../ui/States'
import { plural } from './time'
import { CardHeader, PillButton, Stamp, TextButton } from './ui'

const ROLE_TITLE: Record<AiRole, string> = { categorization: 'Categorization model', chat: 'Chat model' }
const OTHER_ROLE: Record<AiRole, AiRole> = { categorization: 'chat', chat: 'categorization' }
const REMOVE_EFFECT: Record<AiRole, string> = {
  categorization: 'Rules keep running; transactions no rule matches stay uncategorized until you add a model.',
  chat: 'The assistant stops answering until you add a model.',
}

/** The server waits up to 30 s for a test answer and 15 s for a model list; these deadlines leave headroom. */
const TEST_TIMEOUT_MS = 35_000
const MODELS_TIMEOUT_MS = 20_000

const LOCAL_HOSTS: Record<string, true> = { localhost: true, '127.0.0.1': true, '[::1]': true }

function isLocalEndpoint(endpoint: string): boolean {
  try {
    const host = new URL(endpoint.trim()).hostname
    return LOCAL_HOSTS[host] === true || host.endsWith('.localhost')
  } catch {
    return false
  }
}

function savedDraft(current: AiRoleStatus): AiDraft {
  return {
    provider: current.provider,
    endpoint: current.endpoint,
    model: current.model,
    key: current.credentialId ? { use: 'existing', credentialId: current.credentialId } : { use: 'none' },
  }
}

/** The saved config when re-picking the saved provider, otherwise the preset with the first saved key of that provider. */
function draftFor(role: AiRole, provider: AiProvider, state: AiState): AiDraft {
  const current = state.roles[role]
  if (current?.provider === provider) return savedDraft(current)
  const preset = state.presets.find((p) => p.role === role && p.provider === provider)!
  const cred = state.credentials.find((c) => c.provider === provider)
  const key: AiKeyChoice = cred
    ? { use: 'existing', credentialId: cred.id }
    : preset.keyRequired
      ? { use: 'new', apiKey: '' }
      : { use: 'none' }
  return { provider, endpoint: preset.endpoint, model: preset.defaultModel, key }
}

function initialDraft(role: AiRole, state: AiState): AiDraft {
  const current = state.roles[role]
  return current ? savedDraft(current) : draftFor(role, state.presets.find((p) => p.role === role)!.provider, state)
}

function isComplete(draft: AiDraft): boolean {
  if (!draft.endpoint.trim() || !draft.model.trim()) return false
  return draft.key.use === 'new' || draft.key.use === 'replace' ? draft.key.apiKey.trim() !== '' : true
}

function usedByOther(cred: AiCredentialStatus | undefined, role: AiRole): boolean {
  return cred?.usedBy.includes(OTHER_ROLE[role]) ?? false
}

export function AiCard() {
  const state = useResource((signal) => getJson<AiState>('/api/settings/ai', signal))
  return (
    <section id="assistant" className="scroll-mt-6 @container rounded-lg border border-line bg-surface px-[18px] py-4 shadow-1">
      <CardHeader
        title="Assistant"
        meta="Keys are stored encrypted on your server and never shown again. One key can serve both models."
      />
      {state.error ? (
        <div className="mt-3">
          <ErrorState title="Couldn't load the assistant settings" message={state.error} onRetry={state.reload} />
        </div>
      ) : !state.data ? (
        <Loading label="Loading assistant settings" rows={4} />
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 @min-[760px]:grid-cols-2">
          <AiRoleCard role="categorization" state={state.data} reload={state.reload} />
          <AiRoleCard role="chat" state={state.data} reload={state.reload} />
        </div>
      )}
    </section>
  )
}

type Busy = 'test' | 'save' | 'models' | 'remove'

/** Where focus goes after a view change; `base` is the role card's id prefix. */
const FOCUS_TARGET = {
  provider: () => '[data-provider] [aria-pressed="true"]',
  endpoint: (base: string) => `#${base}-endpoint`,
  key: (base: string) => `#${base}-key`,
  credential: (base: string) => `input[name="${base}-key"]:checked`,
  heading: () => '[data-heading]',
  change: () => '[data-change]',
  remove: () => '[data-remove]',
  keep: () => '[data-keep]',
} satisfies Record<string, (base: string) => string>

const STATUS = 'text-[11.5px] font-medium whitespace-nowrap'

function RoleStatus({ current, testing }: { current: AiRoleStatus | null; testing: boolean }) {
  if (!current) return <span className={`${STATUS} text-ink-3`}>Not set up</span>
  if (testing) return <span className={`${STATUS} text-ink-3`}>Testing…</span>
  const test = current.lastTest
  if (!test) return <span className={`${STATUS} text-ink-3`}>Not tested</span>
  if (!test.ok) return <span className={`${STATUS} text-broken`}>Last test failed</span>
  return (
    <Stamp>
      Tested <time dateTime={test.at}>{formatTimestamp(test.at)}</time>
    </Stamp>
  )
}

function AiRoleCard({ role, state, reload }: { role: AiRole; state: AiState; reload: () => void }) {
  const title = ROLE_TITLE[role]
  const other = ROLE_TITLE[OTHER_ROLE[role]].toLowerCase()
  const current = state.roles[role]
  const presets = state.presets.filter((p) => p.role === role)
  const base = `ai-${role}`
  const url = `/api/settings/ai/${role}`

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<AiDraft>(() => initialDraft(role, state))
  const [busy, setBusy] = useState<Busy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<AiTestResult | null>(null)
  const [endpointEditing, setEndpointEditing] = useState(false)
  const [models, setModels] = useState<string[] | null>(null)
  const [modelsError, setModelsError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const card = useRef<HTMLDivElement>(null)
  const focusNext = useRef<keyof typeof FOCUS_TARGET | null>(null)

  const showEdit = !current || editing

  // A pending focus target is kept until its element exists (removal re-renders only after the reload lands).
  useEffect(() => {
    const target = focusNext.current
    if (!target) return
    const el = card.current?.querySelector<HTMLElement>(FOCUS_TARGET[target](base))
    if (!el) return
    focusNext.current = null
    el.focus()
  })

  const resetEditState = () => {
    setError(null)
    setTestResult(null)
    setEndpointEditing(false)
    setModels(null)
    setModelsError(null)
  }

  const update = (patch: Partial<AiDraft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setTestResult(null)
  }

  const setKey = (key: AiKeyChoice) => update({ key })

  const startEdit = () => {
    if (!current) return
    setDraft(savedDraft(current))
    resetEditState()
    focusNext.current = 'provider'
    setEditing(true)
  }

  const cancel = () => {
    if (current) setDraft(savedDraft(current))
    resetEditState()
    focusNext.current = 'change'
    setEditing(false)
  }

  const testSaved = async () => {
    setBusy('test')
    setError(null)
    try {
      await sendJson<AiTestResult>('POST', `${url}/test`, {}, TEST_TIMEOUT_MS)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
      reload()
    }
  }

  const testDraft = async () => {
    setBusy('test')
    setError(null)
    setTestResult(null)
    try {
      setTestResult(await sendJson<AiTestResult>('POST', `${url}/test`, draft, TEST_TIMEOUT_MS))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const save = async () => {
    setBusy('save')
    setError(null)
    let next: AiState
    try {
      next = await sendJson<AiState>('PUT', url, draft)
    } catch (e) {
      setError(errorMessage(e))
      setBusy(null)
      return
    }
    // Drop the typed key from memory; the saved config is tested right away and stored as lastTest.
    setDraft(initialDraft(role, next))
    resetEditState()
    focusNext.current = 'heading'
    setEditing(false)
    reload()
    void testSaved()
  }

  const remove = async () => {
    setBusy('remove')
    setError(null)
    try {
      const next = await sendJson<AiState>('DELETE', url)
      setDraft(initialDraft(role, next))
      resetEditState()
      focusNext.current = 'provider'
      setConfirming(false)
      setEditing(false)
      reload()
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const loadModels = async () => {
    setBusy('models')
    setModelsError(null)
    try {
      const res = await sendJson<{ models: string[] }>(
        'POST',
        `${url}/models`,
        { provider: draft.provider, endpoint: draft.endpoint, key: draft.key },
        MODELS_TIMEOUT_MS,
      )
      setModels(res.models)
    } catch (e) {
      setModels(null)
      setModelsError(errorMessage(e))
    } finally {
      setBusy(null)
    }
  }

  const header = (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <h4 id={`${base}-title`} data-heading tabIndex={-1} className="text-[13px] font-bold text-ink outline-none">
        {title}
      </h4>
      <span className="ml-auto">
        <RoleStatus current={current} testing={busy === 'test' && !showEdit} />
      </span>
    </div>
  )

  if (!showEdit && current) {
    const preset = presets.find((p) => p.provider === current.provider)
    const cred = state.credentials.find((c) => c.id === current.credentialId)
    const keyLine = cred
      ? `${cred.label} · saved ${formatLocalDate(cred.updatedAt)}${usedByOther(cred, role) ? ` · shared with the ${other}` : ''}`
      : 'No key'
    return (
      <div ref={card} role="group" aria-labelledby={`${base}-title`} className="flex min-w-0 flex-col gap-2.5 rounded-md border border-line p-3">
        {header}
        <dl className="grid grid-cols-[72px_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1.5 text-[12.5px]">
          <dt className="text-ink-3">Provider</dt>
          <dd className="min-w-0 font-medium text-ink">{preset?.label ?? current.provider}</dd>
          <dt className="text-ink-3">Endpoint</dt>
          <dd className="min-w-0">
            <code className="block font-mono text-[12px] break-all text-ink-2">
              {current.endpoint}
            </code>
          </dd>
          <dt className="text-ink-3">Model</dt>
          <dd className="min-w-0">
            <code className="block font-mono text-[12px] break-all text-ink-2">
              {current.model}
            </code>
          </dd>
          <dt className="text-ink-3">Key</dt>
          <dd className="min-w-0 text-ink-2">{keyLine}</dd>
        </dl>
        {current.lastTest && busy !== 'test' && (
          <Notice tone={current.lastTest.ok ? 'success' : 'error'}>{current.lastTest.message}</Notice>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {confirming ? (
          <div
            role="group"
            aria-label={`Confirm removing the ${title.toLowerCase()}`}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && busy !== 'remove') {
                e.stopPropagation()
                focusNext.current = 'remove'
                setConfirming(false)
              }
            }}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-line bg-surface px-3 py-2 text-[12.5px]"
          >
            <p className="min-w-48 flex-1 leading-relaxed text-ink-2">
              <b className="font-semibold text-ink">Remove the {title.toLowerCase()}?</b> {REMOVE_EFFECT[role]}
              {cred && !usedByOther(cred, role) ? ' Its key is deleted too.' : ''}
            </p>
            <div className="flex gap-2">
              <PillButton tone="danger" busy={busy === 'remove'} onClick={() => void remove()}>
                {busy === 'remove' ? 'Removing…' : 'Remove'}
              </PillButton>
              <PillButton
                data-keep
                disabled={busy === 'remove'}
                onClick={() => {
                  focusNext.current = 'remove'
                  setConfirming(false)
                }}
              >
                Keep
              </PillButton>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <PillButton busy={busy === 'test'} disabled={busy !== null} onClick={() => void testSaved()}>
              {busy === 'test' ? 'Testing…' : 'Test'}
              <span className="sr-only"> the {title.toLowerCase()}</span>
            </PillButton>
            <TextButton data-change disabled={busy !== null} onClick={startEdit}>
              Change<span className="sr-only"> the {title.toLowerCase()}</span>
            </TextButton>
            <TextButton
              data-remove
              disabled={busy !== null}
              onClick={() => {
                focusNext.current = 'keep'
                setConfirming(true)
              }}
            >
              Remove<span className="sr-only"> the {title.toLowerCase()}</span>
            </TextButton>
          </div>
        )}
      </div>
    )
  }

  const preset: AiPreset = presets.find((p) => p.provider === draft.provider)!
  const creds = state.credentials.filter((c) => c.provider === draft.provider)
  const key = draft.key
  const selectedCredId = key.use === 'existing' || key.use === 'replace' ? key.credentialId : null
  const selectedCred = creds.find((c) => c.id === selectedCredId)
  const typedKey = key.use === 'new' || key.use === 'replace' ? key.apiKey : ''
  const showEndpointInput = endpointEditing || preset.endpoint === ''
  const ready = isComplete(draft)
  const locked = busy !== null
  const radios = creds.length > 0 || !preset.keyRequired

  const setTypedKey = (apiKey: string) => {
    if (key.use === 'new') setKey({ use: 'new', apiKey })
    else if (key.use === 'replace') setKey({ use: 'replace', credentialId: key.credentialId, apiKey })
  }

  const keyInput = (
    <Input
      id={`${base}-key`}
      type="password"
      autoComplete="new-password"
      spellCheck={false}
      aria-label={key.use === 'replace' ? `New value for ${selectedCred?.label ?? 'this key'}` : `${preset.label} key`}
      aria-describedby={`${base}-key-help`}
      placeholder={key.use === 'replace' ? 'Paste the new key' : 'Paste the key'}
      value={typedKey}
      disabled={locked}
      onChange={(e) => setTypedKey(e.target.value)}
    />
  )

  const radio = (value: string, checked: boolean, onSelect: () => void, label: string, meta?: string) => (
    <label className="flex min-w-0 items-baseline gap-2 text-[12.5px] text-ink">
      <input
        type="radio"
        name={`${base}-key`}
        value={value}
        checked={checked}
        disabled={locked}
        onChange={onSelect}
        className="relative top-px shrink-0 accent-accent"
      />
      <span className="min-w-0">
        {label}
        {meta && <span className="text-ink-3"> · {meta}</span>}
      </span>
    </label>
  )

  return (
    <div ref={card} role="group" aria-labelledby={`${base}-title`} className="flex min-w-0 flex-col gap-3.5 rounded-md border border-line p-3">
      {header}

      <div data-provider className="flex min-w-0 flex-col gap-1.5">
        <span id={`${base}-provider`} className="text-sm font-medium text-ink">
          Provider
        </span>
        {/* Wrapping tiles, not Segmented: six chat providers don't fit one scrolling row in a half-width card. */}
        <div role="group" aria-labelledby={`${base}-title ${base}-provider`} className="flex flex-wrap gap-1.5">
          {presets.map((p) => {
            const active = p.provider === draft.provider
            return (
              <button
                key={p.provider}
                type="button"
                aria-pressed={active}
                disabled={locked}
                onClick={() => {
                  if (active) return
                  setDraft(draftFor(role, p.provider, state))
                  resetEditState()
                }}
                className={`h-7 shrink-0 rounded-full border px-[13px] text-[12px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed ${
                  active ? 'border-line-strong bg-surface text-ink ring-1 ring-line-strong' : 'border-line bg-surface-2 text-ink-2 hover:text-ink'
                }`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        {showEndpointInput ? (
          <Field id={`${base}-endpoint`} label="Endpoint">
            <Input
              id={`${base}-endpoint`}
              type="url"
              inputMode="url"
              spellCheck={false}
              autoComplete="off"
              placeholder="https://"
              value={draft.endpoint}
              disabled={locked}
              onChange={(e) => update({ endpoint: e.target.value })}
            />
          </Field>
        ) : (
          <>
            <span className="text-sm font-medium text-ink">Endpoint</span>
            <div className="flex min-w-0 items-center gap-2.5">
              <code
                className="min-w-0 flex-1 rounded-sm border border-line bg-surface-2 px-[9px] py-1.5 font-mono text-[12px] break-all text-ink"
              >
                {draft.endpoint}
              </code>
              <TextButton
                disabled={locked}
                onClick={() => {
                  focusNext.current = 'endpoint'
                  setEndpointEditing(true)
                }}
              >
                Edit<span className="sr-only"> endpoint</span>
              </TextButton>
            </div>
          </>
        )}
        {preset.endpointChoices && preset.endpointChoices.length > 0 && (
          <div role="group" aria-label="Local server" className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {preset.endpointChoices.map((c) => {
              const active = draft.endpoint.trim().replace(/\/+$/, '') === c.endpoint
              return (
                <TextButton
                  key={c.endpoint}
                  aria-pressed={active}
                  disabled={locked}
                  className={active ? 'border-line-strong text-ink' : ''}
                  onClick={() => update({ endpoint: c.endpoint })}
                >
                  {c.label}
                </TextButton>
              )
            })}
          </div>
        )}
      </div>

      <fieldset className="flex min-w-0 flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium text-ink">Key</legend>
        {radios ? (
          <div className="flex flex-col gap-1.5">
            {creds.map((c) => (
              <div key={c.id} className="flex min-w-0 flex-col gap-1.5">
                {radio(
                  c.id,
                  selectedCredId === c.id,
                  () => setKey({ use: 'existing', credentialId: c.id }),
                  `Use ${c.label}`,
                  `saved ${formatLocalDate(c.updatedAt)}${usedByOther(c, role) ? ` · used by the ${other}` : ''}`,
                )}
                {selectedCredId === c.id && key.use === 'existing' && (
                  <div className="pl-5">
                    <TextButton
                      disabled={locked}
                      onClick={() => {
                        focusNext.current = 'key'
                        setKey({ use: 'replace', credentialId: c.id, apiKey: '' })
                      }}
                    >
                      Replace this key
                    </TextButton>
                  </div>
                )}
                {selectedCredId === c.id && key.use === 'replace' && (
                  <div className="flex min-w-0 flex-col gap-1.5 pl-5">
                    {keyInput}
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px] text-ink-3">
                      {usedByOther(c, role) && <span>Replacing it changes it for the {other} too.</span>}
                      <TextButton
                        disabled={locked}
                        onClick={() => {
                          focusNext.current = 'credential'
                          setKey({ use: 'existing', credentialId: c.id })
                        }}
                      >
                        Keep the saved key
                      </TextButton>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {radio(
              'new',
              key.use === 'new',
              () => setKey({ use: 'new', apiKey: '' }),
              creds.length > 0 ? 'Use a different key for this role' : 'Use a key',
            )}
            {key.use === 'new' && <div className="min-w-0 pl-5">{keyInput}</div>}
            {!preset.keyRequired && radio('none', key.use === 'none', () => setKey({ use: 'none' }), 'No key')}
          </div>
        ) : (
          keyInput
        )}
        <p id={`${base}-key-help`} className="text-[12px] leading-normal text-ink-3">
          {preset.keyHint}
          {preset.keyUrl && (
            <>
              {' · '}
              <a
                href={preset.keyUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 font-semibold text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink"
              >
                Get a key
                <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-3 shrink-0">
                  <path d="M6 3h7v7M13 3 4 12" />
                </svg>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </>
          )}
        </p>
      </fieldset>

      <Field id={`${base}-model`} label="Model" help={preset.note}>
        <div className="flex min-w-0 items-center gap-2.5">
          <Input
            id={`${base}-model`}
            type="text"
            list={`${base}-models`}
            spellCheck={false}
            autoComplete="off"
            aria-describedby={preset.note ? `${base}-model-help` : undefined}
            className="min-w-0 flex-1"
            value={draft.model}
            disabled={locked}
            onChange={(e) => update({ model: e.target.value })}
          />
          <TextButton busy={busy === 'models'} disabled={locked || !draft.endpoint.trim()} onClick={() => void loadModels()}>
            Load models
          </TextButton>
        </div>
        <datalist id={`${base}-models`}>
          {models?.map((m) => <option key={m} value={m} />)}
        </datalist>
        {models && (
          <p role="status" className="text-[12px] text-ink-3">
            {models.length > 0 ? `${plural(models.length, 'model')} listed. Type to pick one.` : 'The provider listed no models. Type the model id.'}
          </p>
        )}
        {modelsError && <Notice tone="error">{modelsError}</Notice>}
      </Field>

      <p className="text-[12px] leading-normal text-ink-3">
        {isLocalEndpoint(draft.endpoint) ? (
          'Stays on this machine (local server).'
        ) : (
          <>
            <b className="font-semibold text-ink-2">Sends</b> {state.sends[role]}
          </>
        )}
      </p>

      {testResult && (
        <Notice tone={testResult.ok ? 'success' : 'error'}>
          {testResult.message}
          {testResult.latencyMs !== null && <span className="figures"> · {testResult.latencyMs} ms</span>}
        </Notice>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" busy={busy === 'test'} disabled={!ready || locked} onClick={() => void testDraft()}>
          {busy === 'test' ? 'Testing…' : 'Test'}
          <span className="sr-only"> the {title.toLowerCase()} draft</span>
        </Button>
        <Button size="sm" variant="primary" busy={busy === 'save'} disabled={!ready || locked} onClick={() => void save()}>
          {busy === 'save' ? 'Saving…' : 'Save'}
          <span className="sr-only"> the {title.toLowerCase()}</span>
        </Button>
        {current && (
          <Button size="sm" variant="ghost" disabled={locked} onClick={cancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}
