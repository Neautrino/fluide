import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react'

const CONTROL =
  'h-[38px] w-full rounded-sm border border-line bg-surface px-3 text-[13px] text-ink placeholder:text-ink-3 transition-colors hover:border-line-strong focus-visible:border-line-strong focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-3 aria-[invalid=true]:border-broken'

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`${CONTROL} ${className}`} />
}

const PILL =
  'h-[34px] w-full cursor-pointer appearance-none truncate rounded-full border border-line bg-surface pl-3 pr-[30px] text-[12.5px] text-ink transition-colors hover:border-line-strong focus-visible:border-accent focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-3 aria-[invalid=true]:border-broken'

export function Select({
  className = '',
  children,
  pill = false,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { pill?: boolean }) {
  return (
    <span className={`relative block ${className}`}>
      <select {...rest} className={pill ? PILL : `${CONTROL} cursor-pointer appearance-none truncate pr-9`}>
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`pointer-events-none absolute top-1/2 size-3.5 -translate-y-1/2 text-ink-3 ${pill ? 'right-[12px]' : 'right-3'}`}
      >
        <path d="M4 6l4 4 4-4" />
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
        <p id={`${id}-error`} className="text-[13px] font-medium text-broken">
          {error}
        </p>
      )}
    </div>
  )
}
