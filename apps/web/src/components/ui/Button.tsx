import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-surface-inverse text-ink-inverse border border-surface-inverse hover:opacity-90 active:translate-y-px disabled:bg-surface-2 disabled:border-line disabled:text-ink-3',
  secondary:
    'bg-surface text-ink border border-line-strong hover:border-ink-3 hover:bg-canvas active:bg-surface-2 disabled:text-ink-3 disabled:border-line disabled:bg-canvas',
  ghost: 'text-ink-2 border border-transparent hover:text-ink hover:bg-surface-2 active:bg-line/60 disabled:text-ink-3',
  danger:
    'bg-surface text-broken border border-line-strong hover:border-broken hover:bg-broken-wash active:bg-broken-wash disabled:text-ink-3 disabled:border-line',
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
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${className}`}
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
