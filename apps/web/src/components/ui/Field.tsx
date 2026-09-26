import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

const CONTROL =
  'h-10 w-full rounded-[3px] border border-rule-strong bg-paper-raised px-3 text-sm text-ink placeholder:text-ink-3 transition-colors hover:border-ink-3 focus-visible:border-green focus-visible:outline-green disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-3 aria-[invalid=true]:border-red'

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`${CONTROL} ${className}`} />
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={`relative block ${className}`}>
      <select {...rest} className={`${CONTROL} appearance-none truncate pr-9`}>
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 12 12"
        className="pointer-events-none absolute top-1/2 right-3 size-3 -translate-y-1/2 text-ink-3"
      >
        <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    </span>
  )
}

type FieldProps = {
  id: string
  label: string
  help?: ReactNode
  error?: string | null
  children: ReactNode
}

/** The control inside must carry `id` and `aria-describedby={`${id}-help ${id}-error`}`. */
export function Field({ id, label, help, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {help && (
        <p id={`${id}-help`} className="text-[13px] leading-relaxed text-ink-3">
          {help}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-[13px] font-medium text-red">
          {error}
        </p>
      )}
    </div>
  )
}
