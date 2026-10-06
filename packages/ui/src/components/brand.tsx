import { useId } from 'react'

const WORDMARK = 'flex items-center gap-2.5 pl-1 font-display text-[22px] font-extrabold tracking-[-0.02em] text-ink'

export function LogoMark({ className = 'size-6' }: { className?: string }) {
  const clipId = useId()
  return (
    <svg viewBox="0 0 100 100" fill="none" className={className} aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r="39.5" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="6" />
      <g clipPath={`url(#${clipId})`}>
        <path d="M 5 50.0 L 25 46.5 L 50 50.0 L 75 53.5 L 95 50.0" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 5 58.5 L 25 55.0 L 50 58.5 L 75 62.0 L 95 58.5" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 5 67.0 L 25 63.5 L 50 67.0 L 75 70.5 L 95 67.0" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 5 75.5 L 25 72.0 L 50 75.5 L 75 79.0 L 95 75.5" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M 5 84.0 L 25 80.5 L 50 84.0 L 75 87.5 L 95 84.0" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <div className={className ? `${WORDMARK} ${className}` : WORDMARK}>
      <LogoMark className="size-6 flex-none text-ink" />
      <span>fluide<i className="not-italic text-ink-3 -ml-[0.12em]">_</i></span>
    </div>
  )
}
