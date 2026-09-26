import type { ReactNode } from 'react'
import { Button } from './Button'

export function Loading({ label = 'Loading…', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3 py-2">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-6">
          <div className="h-3 animate-pulse rounded-sm bg-paper-sunk" style={{ width: `${56 - i * 9}%` }} />
          <div className="h-3 w-16 animate-pulse rounded-sm bg-paper-sunk" />
        </div>
      ))}
    </div>
  )
}

export function ErrorState({ title, message, onRetry }: { title: string; message: string | null; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 border-l-2 border-red py-1 pl-4">
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        {message && <p className="mt-0.5 text-[13px] text-ink-3">{message}</p>}
      </div>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="py-6">
      <p className="font-display text-lg text-ink">{title}</p>
      {children && <div className="mt-1 max-w-prose text-sm text-ink-3">{children}</div>}
    </div>
  )
}

type Tone = 'success' | 'info' | 'error'

const TONE: Record<Tone, string> = {
  success: 'border-green bg-green-wash text-green-deep',
  info: 'border-rule-strong bg-paper-sunk text-ink-2',
  error: 'border-red bg-red-wash text-red',
}

export function Notice({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-[3px] border-l-2 px-3 py-2 text-[13px] leading-relaxed ${TONE[tone]}`}
    >
      {children}
    </div>
  )
}
