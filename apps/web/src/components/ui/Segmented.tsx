import type { ReactNode } from 'react'

type Option<T extends string> = { value: T; label: ReactNode }

type Props<T extends string> = {
  label: string
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
}

export function Segmented<T extends string>({ label, value, options, onChange }: Props<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex max-w-full overflow-x-auto rounded-md border border-line-strong bg-surface p-0.5"
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={`h-8 shrink-0 rounded-sm px-3 text-[13px] whitespace-nowrap transition-colors ${
              active ? 'bg-surface-inverse font-medium text-ink-inverse' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
