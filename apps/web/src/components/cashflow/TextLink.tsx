import type { ReactNode } from 'react'

export function TextLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-b border-line-strong text-[12px] font-semibold whitespace-nowrap text-ink hover:border-ink"
    >
      {children}
    </button>
  )
}
