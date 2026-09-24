import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** SOURCE OF TRUTH: the right-hand side sheet.
 * WHAT: modal dialog sliding in from the right; Escape or the scrim closes
 * it, focus moves into it on open, Tab is kept inside, and focus returns to
 * the opener on close.
 * WHERE: layout + a11y only; content is the caller's.
 */

type Props = {
  title: string
  onClose: () => void
  children: ReactNode
}

export function Drawer({ title, onClose, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    panel?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const focusable = panel.querySelectorAll<HTMLElement>(
        'button:not(:disabled), select:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
      opener?.focus()
    }
  }, [])

  // Portalled to <body>: an animated (transformed) ancestor would otherwise
  // become the containing block for `position: fixed`.
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div aria-hidden className="absolute inset-0 bg-ink/25" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-[480px] animate-drawer flex-col border-l border-rule-strong bg-paper-raised shadow-[-12px_0_32px_-24px_rgba(27,26,23,0.45)] outline-none"
      >
        <div className="flex items-center justify-between border-b border-rule px-6 py-3">
          <p className="eyebrow">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 inline-flex size-9 items-center justify-center rounded-[3px] text-ink-2 hover:bg-paper-sunk hover:text-ink"
            aria-label="Close"
          >
            <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
              <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
