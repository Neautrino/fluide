import type { ReactNode } from 'react'
import type { AiProvider } from '../../types'

/** The wrapping provider tiles — not Segmented: six chat providers don't fit one scrolling row in a half-width card. */
export function ProviderTiles({
  presets,
  value,
  labelId,
  labelledBy,
  disabled = false,
  onChange,
}: {
  presets: { provider: AiProvider; label: string }[]
  value: AiProvider
  /** Id given to the "Provider" caption, so the group can point at it. */
  labelId: string
  /** Ids the tile group is labelled by, e.g. `"ai-chat-title ai-chat-provider"`. */
  labelledBy: string
  disabled?: boolean
  onChange: (provider: AiProvider) => void
}) {
  return (
    <div data-provider className="flex min-w-0 flex-col gap-1.5">
      <span id={labelId} className="text-sm font-medium text-ink">
        Provider
      </span>
      <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-1.5">
        {presets.map((p) => {
          const active = p.provider === value
          return (
            <button
              key={p.provider}
              type="button"
              aria-pressed={active}
              disabled={disabled}
              onClick={() => {
                if (active) return
                onChange(p.provider)
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
  )
}

/** What a configured role is set to: provider, endpoint, model and which key it uses. */
export function ModelSummary({
  provider,
  endpoint,
  model,
  keyLine,
}: {
  provider: string
  endpoint: string
  model: string
  keyLine: ReactNode
}) {
  return (
    <dl className="grid grid-cols-[72px_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1.5 text-[12.5px]">
      <dt className="text-ink-3">Provider</dt>
      <dd className="min-w-0 font-medium text-ink">{provider}</dd>
      <dt className="text-ink-3">Endpoint</dt>
      <dd className="min-w-0">
        <code className="block font-mono text-[12px] break-all text-ink-2">{endpoint}</code>
      </dd>
      <dt className="text-ink-3">Model</dt>
      <dd className="min-w-0">
        <code className="block font-mono text-[12px] break-all text-ink-2">{model}</code>
      </dd>
      <dt className="text-ink-3">Key</dt>
      <dd className="min-w-0 text-ink-2">{keyLine}</dd>
    </dl>
  )
}
