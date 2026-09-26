import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-green text-paper-raised border border-green hover:bg-green-deep hover:border-green-deep active:translate-y-px disabled:bg-paper-sunk disabled:border-rule disabled:text-ink-3',
  secondary:
    'bg-paper-raised text-ink border border-rule-strong hover:border-ink-3 hover:bg-paper active:bg-paper-sunk disabled:text-ink-3 disabled:border-rule disabled:bg-paper',
  ghost: 'text-ink-2 border border-transparent hover:text-ink hover:bg-paper-sunk active:bg-rule/60 disabled:text-ink-3',
  danger:
    'bg-paper-raised text-red border border-rule-strong hover:border-red hover:bg-red-wash active:bg-red-wash disabled:text-ink-3 disabled:border-rule',
}

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  busy?: boolean
  children: ReactNode
}

export function Button({ variant = 'secondary', size = 'md', busy = false, className = '', disabled, children, ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex shrink-0 items-center justify-center rounded-[3px] font-medium whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${className}`}
    >
      {busy && <Spinner />}
      {children}
    </button>
  )
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-3.5 animate-spin rounded-full border-[1.5px] border-current border-r-transparent ${className}`}
    />
  )
}
