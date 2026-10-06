import type { HTMLAttributes } from 'react'

type Props = HTMLAttributes<HTMLSpanElement> & {
  /** `dark` inside a `data-theme="dark"` band (How it works, Security): outline only, no fill */
  tone?: 'light' | 'dark'
  /** numbered from the page's `[counter-reset:dsec]` (the landing); off on single-tag pages */
  numbered?: boolean
}

/** The DS01 section tag: a mono pill, numbered 01, 02 … down the landing. */
export function SectionTag({ tone = 'light', numbered = true, className = '', ...rest }: Props) {
  const look = tone === 'dark' ? 'border-line-strong text-ink' : 'border-line-strong bg-surface text-ink'
  const number = numbered
    ? '[counter-increment:dsec] before:border-r before:border-current before:pr-2 before:content-[counter(dsec,decimal-leading-zero)]'
    : ''
  return (
    <span
      className={`inline-flex h-7 items-center gap-2 rounded-full border px-3 font-mono text-[11.5px] leading-none font-semibold tracking-[0.06em] uppercase ${look} ${number} ${className}`}
      {...rest}
    />
  )
}
