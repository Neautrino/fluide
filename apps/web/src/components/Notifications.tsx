import { useEffect, useId, useRef, useState } from 'react'
import { useApp } from '../lib/app-context'
import { useNotifications, type Notification, type NotificationTone } from '../lib/notifications'
import { scrollToSection } from './settings/scroll'

const DOT: Record<NotificationTone, string> = { accent: 'bg-accent', warning: 'bg-warning', broken: 'bg-broken' }

function badgeTone(items: Notification[]): NotificationTone {
  if (items.some((n) => n.tone === 'broken')) return 'broken'
  if (items.some((n) => n.tone === 'warning')) return 'warning'
  return 'accent'
}

function scrollWhenSettled(id: string) {
  const started = performance.now()
  let last = Number.NaN
  let stable = 0
  const tick = () => {
    const el = document.getElementById(id)
    const top = el ? el.getBoundingClientRect().top + window.scrollY : Number.NaN
    const loading = document.querySelector('main [role="status"][aria-live="polite"]') !== null
    stable = top === last && !loading ? stable + 1 : 0
    last = top
    if ((el && stable >= 5) || performance.now() - started > 3000) scrollToSection(id)
    else requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

export function Notifications() {
  const { navigate } = useApp()
  const items = useNotifications()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const bell = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open) return
    ;(panel.current?.querySelector<HTMLElement>('button') ?? panel.current)?.focus()
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      bell.current?.focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const go = (n: Notification) => {
    setOpen(false)
    bell.current?.focus()
    navigate(n.view)
    const { section } = n
    if (section) scrollWhenSettled(section)
  }

  return (
    <div ref={root} className="relative flex-none">
      <button
        ref={bell}
        type="button"
        className="relative grid h-[40px] w-[40px] place-items-center rounded-full border border-line-strong bg-surface hover:bg-surface-2 transition-colors"
        title="Notifications"
        aria-label={items.length > 0 ? `Notifications, ${items.length}` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 16 16" className="h-[17px] w-[17px] text-ink" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 11.5V7a4 4 0 0 1 8 0v4.5l1.2 1.3H2.8z" />
          <path d="M6.5 14.2a1.6 1.6 0 0 0 3 0" />
        </svg>
        {items.length > 0 && (
          <span aria-hidden className={`absolute top-[1px] right-[1px] size-2 rounded-full ring-2 ring-surface ${DOT[badgeTone(items)]}`} />
        )}
      </button>
      {open && (
        <div
          ref={panel}
          id={id}
          role="dialog"
          aria-label="Notifications"
          tabIndex={-1}
          className="absolute top-full right-0 z-30 mt-2 w-[320px] max-w-[calc(100vw-56px)] rounded-md border border-line bg-surface p-2 text-[13px] shadow-2 outline-0"
        >
          <h2 className="px-2 pt-1 pb-2 text-[13px] font-semibold text-ink">Notifications</h2>
          {items.length === 0 ? (
            <p className="px-2 pb-2 text-ink-2">You're all caught up</p>
          ) : (
            <ul className="flex flex-col">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => go(n)}
                    className="flex w-full items-start gap-2.5 rounded-sm px-2 py-2 text-left hover:bg-surface-2 focus-visible:bg-surface-2"
                  >
                    <span aria-hidden className={`mt-[5px] size-2 flex-none rounded-full ${DOT[n.tone]}`} />
                    <span className="min-w-0">
                      <span className="block font-medium text-ink">{n.text}</span>
                      {n.detail && <span className="block text-[12px] text-ink-3">{n.detail}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
