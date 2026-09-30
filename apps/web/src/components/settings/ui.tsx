import type { ComponentProps, ReactNode, Ref } from 'react'
import { Spinner } from '../ui/Button'

type Tone = 'secondary' | 'primary' | 'broken' | 'danger'

const TONE: Record<Tone, string> = {
  secondary: 'border-line-strong bg-surface text-ink hover:bg-surface-2',
  primary: 'border-surface-inverse bg-surface-inverse text-ink-inverse hover:opacity-90',
  danger: 'border-line-strong bg-surface text-broken hover:border-broken hover:bg-broken-wash',
  broken: 'border-broken bg-broken text-ink-inverse hover:opacity-90',
}

type Props = ComponentProps<'button'> & { busy?: boolean; children: ReactNode }

export function PillButton({ tone = 'secondary', busy = false, className = '', disabled, children, ...rest }: Props & { tone?: Tone }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex h-[30px] shrink-0 items-center justify-center gap-[7px] rounded-full border px-[13px] text-[12px] font-bold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-2 disabled:text-ink-3 ${TONE[tone]} ${className}`}
    >
      {busy && <Spinner className="size-3" />}
      {children}
    </button>
  )
}

export function TextButton({ busy = false, className = '', disabled, children, ...rest }: Props) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={`inline-flex shrink-0 items-center gap-1.5 border-b border-line pb-px text-[12px] font-semibold whitespace-nowrap text-ink-3 transition-colors hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-line disabled:hover:text-ink-3 ${className}`}
    >
      {busy && <Spinner className="size-3" />}
      {children}
    </button>
  )
}

export function CardHeader({
  title,
  meta,
  aside,
  level = 3,
  headingRef,
}: {
  title: string
  meta?: ReactNode
  aside?: ReactNode
  level?: 2 | 3
  /** Makes the heading a programmatic focus target (tabIndex -1). */
  headingRef?: Ref<HTMLHeadingElement>
}) {
  const Heading = level === 2 ? 'h2' : 'h3'
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <Heading
        ref={headingRef}
        tabIndex={headingRef ? -1 : undefined}
        className="font-display text-[17px] leading-[1.2] font-bold tracking-[-0.01em] text-ink outline-none"
      >
        {title}
      </Heading>
      {meta && <span className="figures text-[12px] text-ink-3">{meta}</span>}
      {aside && <div className="ml-auto">{aside}</div>}
    </div>
  )
}

export function Stamp({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] whitespace-nowrap text-ink-3">
      <span aria-hidden className="size-1.5 rounded-full bg-positive" />
      {children}
    </span>
  )
}

export type Look = Tone | 'text'

export function ActionButton({ look, ...rest }: Props & { look: Look }) {
  return look === 'text' ? <TextButton {...rest} /> : <PillButton tone={look} {...rest} />
}
