import { useEffect, useState, useRef } from 'react'
import { sendJson } from '../lib/api'
import { useApp, type View } from '../lib/app-context'
import { useHiddenAmounts, useTheme } from '../lib/prefs'
import { NAV } from './Sidebar'

function getGreeting(date: Date) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function getDaysLeft(date: Date) {
  const daysLeft = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate() - date.getDate()
  const monthName = date.toLocaleString('default', { month: 'long' })
  if (daysLeft === 0) return `Last day of ${monthName}`
  if (daysLeft === 1) return `1 day left in ${monthName}`
  return `${daysLeft} days left in ${monthName}`
}

const SUBTITLE: Partial<Record<View, string>> = {
  transactions: 'every account, one list',
  accounts: 'what you have and owe',
  cashflow: 'money in and out',
  rules: 'categorization',
  settings: 'connections and categorization',
  assistant: 'answers from your ledger',
}

function subtitleFor(view: View, reviewCount: number | null) {
  if (view === 'review') return reviewCount === null ? 'waiting' : `${reviewCount} waiting`
  return SUBTITLE[view]
}

export function Header() {
  const { view, invalidate, ask, reviewCount } = useApp()
  const { hiddenAmounts, toggleHiddenAmounts } = useHiddenAmounts()
  const { theme, toggleTheme } = useTheme()
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  
  const title = NAV.find((n) => n.view === view)?.label || 'Overview'
  const date = new Date()

  const dateStr = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(date)
  const subtitle = subtitleFor(view, reviewCount)
  const topLine = subtitle ? `${dateStr} · ${subtitle}` : `${getGreeting(date)} · ${getDaysLeft(date)}`

  const handleSync = async () => {
    if (syncing) return
    setSyncing(true)
    setSyncError(null)
    try {
      await sendJson('POST', '/api/providers/sync', undefined, 120_000)
      invalidate()
    } catch {
      setSyncError('Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const [askText, setAskText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName || '')) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleAsk = (e: React.FormEvent) => {
    e.preventDefault()
    if (!askText.trim()) return
    ask(askText.trim())
    setAskText('')
  }

  return (
    <header className="flex items-center gap-4 pt-[26px]">
      <div>
        <small className="mb-[3px] block text-[13px] text-ink-2">
          {topLine}
        </small>
        <h1 className="whitespace-nowrap font-display text-[23px] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">
          {title}
        </h1>
      </div>

      <div className="ml-auto flex items-center gap-4">
        {syncError && <span className="text-[12px] font-medium text-broken">{syncError}</span>}
        
        {view !== 'assistant' && (
          <form
            onSubmit={handleAsk}
            className="hidden relative md:flex w-[360px] xl:w-[420px] items-center gap-[9px] h-[40px] rounded-[20px] border border-line bg-surface px-1.5 pl-[14px]"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4 flex-none text-ink-2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
              <path d="M8 1.8 9.3 6.7 14.2 8 9.3 9.3 8 14.2 6.7 9.3 1.8 8 6.7 6.7z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Ask about your money…"
              aria-label="Ask about your money"
              className="flex-1 bg-transparent border-0 outline-0 text-[13px] min-w-0 placeholder:text-ink-3 text-ink"
              value={askText}
              onChange={(e) => setAskText(e.target.value)}
            />
            <kbd className="rounded-[6px] border border-line px-1.5 py-1 font-mono text-[10.5px] font-semibold text-ink-3">
              /
            </kbd>
          </form>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            className="grid h-[40px] w-[40px] flex-none place-items-center rounded-full border border-line-strong bg-surface hover:bg-surface-2 transition-colors disabled:opacity-50"
            title="Sync connections"
            aria-label="Sync"
            onClick={handleSync}
            disabled={syncing}
          >
            <svg viewBox="0 0 16 16" className={`h-[17px] w-[17px] text-ink ${syncing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13.5 6.5A5.6 5.6 0 0 0 3.2 4.6M2.5 9.5a5.6 5.6 0 0 0 10.3 1.9" />
              <path d="M3 1.8v3h3M13 14.2v-3h-3" />
            </svg>
          </button>
          
          <button
            type="button"
            className="grid h-[40px] w-[40px] flex-none place-items-center rounded-full border border-line-strong bg-surface hover:bg-surface-2 transition-colors"
            title="Hide amounts"
            aria-label="Hide amounts"
            aria-pressed={hiddenAmounts}
            onClick={toggleHiddenAmounts}
          >
            <svg viewBox="0 0 16 16" className="h-[17px] w-[17px] text-ink" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              {hiddenAmounts ? (
                <>
                  <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
                  <path d="M14 2L2 14" />
                </>
              ) : (
                <>
                  <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" />
                  <circle cx="8" cy="8" r="2" />
                </>
              )}
            </svg>
          </button>

          <button
            type="button"
            className="grid h-[40px] w-[40px] flex-none place-items-center rounded-full border border-line-strong bg-surface hover:bg-surface-2 transition-colors"
            title="Dark theme"
            aria-label="Toggle theme"
            aria-pressed={theme === 'dark'}
            onClick={toggleTheme}
          >
            <svg viewBox="0 0 16 16" className="h-[17px] w-[17px] text-ink" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 2a6 6 0 0 0 0 12z" fill="currentColor" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}
