import { useRef, useState } from 'react'
import { errorMessage, getJson, sendJson, type GateSettings, type ReviewItem } from '../../lib/api'
import { useApp } from '../../lib/app-context'
import { categoryName, useCategories } from '../../lib/categories'
import { formatConfidence, formatMoneyParts, formatTimestamp, toNumber } from '../../lib/format'
import { useResource } from '../../lib/useResource'
import { Button } from '../ui/Button'
import { ErrorState, Loading, Notice } from '../ui/States'
import { GateChart } from './GateChart'
import { DEFAULTS, FIELDS, toDraft, validate, type Draft, type Key } from './gate'
import { CardHeader, Stamp } from './ui'

const NOTE_LIMIT = 5

function WaitingNote({ items }: { items: ReviewItem[] }) {
  const categories = useCategories()
  const shown = items.slice(0, NOTE_LIMIT)
  return (
    <p className="mt-2.5 text-[12px] leading-normal text-ink-3">
      Waiting now:{' '}
      {shown.map((item, i) => {
        const p = item.posting
        const { whole, fraction } = formatMoneyParts(p?.amount ?? 0, p?.currency ?? 'USD', 'always')
        return (
          <span key={item.id}>
            {i > 0 && ' · '}
            <b className="font-semibold text-ink-2">{p?.counterpartyRaw ?? p?.description ?? 'Unknown'}</b>{' '}
            {p && (
              <span className="amt">
                {whole}
                <small>{fraction}</small>
              </span>
            )}{' '}
            {item.suggestedCategoryId ? categoryName(categories.data, item.suggestedCategoryId) : 'no suggestion'}{' '}
            {formatConfidence(item.confidence)}
          </span>
        )
      })}
      {items.length > NOTE_LIMIT && ` · and ${items.length - NOTE_LIMIT} more`}
    </p>
  )
}

export function GateCard() {
  const settings = useResource((signal) => getJson<{ settings: GateSettings }>('/api/assistant/gate', signal).then((r) => r.settings))

  return (
    <section id="categorization" className="scroll-mt-6 rounded-lg border border-line bg-surface px-[18px] py-4 shadow-1">
      {settings.error ? (
        <ErrorState title="Couldn't load the gate settings" message={settings.error} onRetry={settings.reload} />
      ) : !settings.data ? (
        <Loading label="Loading settings" rows={4} />
      ) : (
        <GateForm initial={settings.data} />
      )}
    </section>
  )
}

function GateForm({ initial }: { initial: GateSettings }) {
  const [saved, setSaved] = useState<GateSettings>(initial)
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial))
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const inputs = useRef<Partial<Record<Key, HTMLInputElement | null>>>({})
  const { version, navigate } = useApp()
  const queue = useResource(
    (signal) => getJson<{ items: ReviewItem[] }>('/api/assistant/review-queue', signal).then((r) => r.items),
    version,
  )
  const waiting = queue.data ?? []

  const errors = validate(draft)
  const dirty = (Object.keys(draft) as Key[]).some((k) => draft[k].trim() === '' || Number(draft[k]) !== toNumber(saved[k]))
  const bandsValid = !errors.highConfidence && !errors.lowConfidence

  const update = (k: Key, v: string) => {
    setDraft((d) => ({ ...d, [k]: v }))
    setTouched(true)
    setJustSaved(false)
    setServerError(null)
  }

  const save = async () => {
    setTouched(true)
    const firstInvalid = FIELDS.find((f) => errors[f.key])
    if (firstInvalid) {
      inputs.current[firstInvalid.key]?.focus()
      return
    }
    setBusy(true)
    setServerError(null)
    try {
      const { settings } = await sendJson<{ settings: GateSettings }>('PUT', '/api/assistant/gate', {
        highConfidence: Number(draft.highConfidence),
        lowConfidence: Number(draft.lowConfidence),
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
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <CardHeader
        title="Categorization gate"
        meta="How sure the model must be before it acts"
        aside={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-3">
            {waiting.length > 0 && (
              <>
                <Stamp>{waiting.length} waiting</Stamp>
                <button type="button" onClick={() => navigate('review')} className="hover:text-ink">
                  Open Review ›
                </button>
              </>
            )}
            {saved.updatedAt ? `Last saved ${formatTimestamp(saved.updatedAt)}` : 'Using defaults'}
          </span>
        }
      />
      <div className="mt-2">
        <GateChart
          low={bandsValid ? Number(draft.lowConfidence) : Number.NaN}
          high={bandsValid ? Number(draft.highConfidence) : Number.NaN}
          markers={waiting.map((item) => toNumber(item.confidence))}
        />
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-2.5 min-[1361px]:grid-cols-3">
        {FIELDS.map((f) => {
          const error = touched ? errors[f.key] : undefined
          const id = `gate-${f.key}`
          return (
            <div key={f.key} className="flex min-w-0 flex-col gap-1 rounded-sm border border-line px-2.5 py-[9px]">
              <label htmlFor={id} className="text-[11px] font-semibold tracking-[0.02em] text-ink-3">
                {f.label}
              </label>
              <input
                ref={(el) => {
                  inputs.current[f.key] = el
                }}
                id={id}
                type="number"
                inputMode={f.inputMode}
                step={f.step}
                min={f.min}
                max={f.max}
                value={draft[f.key]}
                onChange={(e) => update(f.key, e.target.value)}
                aria-invalid={!!error}
                aria-describedby={`${id}-help ${id}-error`}
                className="figures h-[30px] w-full rounded-sm border border-line bg-surface px-2 font-display text-[14px] font-bold text-ink focus-visible:border-line-strong aria-[invalid=true]:border-broken"
              />
              <small id={`${id}-help`} className="text-[10.5px] leading-[1.35] text-ink-3">
                {f.help}
              </small>
              {error && (
                <small id={`${id}-error`} className="text-[11px] font-medium text-broken">
                  {error}
                </small>
              )}
            </div>
          )
        })}
      </div>

      {waiting.length > 0 && <WaitingNote items={waiting} />}

      <p className="mt-2.5 text-[12px] leading-normal text-ink-3">
        Rules you've activated always run first. For everything else the Jev model proposes a category with a confidence
        score, and the gate decides what happens next. At or above the high threshold a category is applied right away,
        unless the vendor's earlier transactions in that category make the amount look unusual — then it waits in Review.
      </p>

      <div className="mt-3 flex flex-col gap-3 border-t border-line pt-3">
        {serverError && <Notice tone="error">The server rejected these settings: {serverError}</Notice>}
        {justSaved && <Notice tone="success">Saved. The next categorization run uses these thresholds.</Notice>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" variant="primary" busy={busy} disabled={!dirty}>
            {busy ? 'Saving…' : 'Save settings'}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setDraft(toDraft(saved))
              setTouched(false)
              setServerError(null)
            }}
            disabled={!dirty || busy}
          >
            Discard changes
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(DEFAULTS)
              setTouched(true)
              setJustSaved(false)
            }}
            disabled={busy}
          >
            Restore defaults
          </Button>
        </div>
      </div>
    </form>
  )
}
