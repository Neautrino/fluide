import { useQueryClient } from '@tanstack/react-query'
import { useMatchRoute } from '@tanstack/react-router'
import { useEffect, useState, useRef } from 'react'
import {
  getDaysLeft,
  getGreeting,
  HEADER_SUBTITLE,
  HeaderAskBox,
  HeaderButton,
  HeaderView,
  HideAmountsIcon,
  NAV,
  SyncIcon,
  ThemeIcon,
} from '@repo/ui/shell'
import { sendJson } from '../lib/api'
import { useApp } from '../lib/app-context'
import { useHiddenAmounts, useTheme } from '../lib/prefs'
import { useReviewCount } from '../lib/queries'
import { Notifications } from './Notifications'

export function Header() {
  const { ask } = useApp()
  const matchRoute = useMatchRoute()
  const queryClient = useQueryClient()
  const reviewCount = useReviewCount()
  const { hiddenAmounts, toggleHiddenAmounts } = useHiddenAmounts()
  const { theme, toggleTheme } = useTheme()
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const current = NAV.find((item) => matchRoute({ to: item.to, fuzzy: item.to !== '/' }))
  const title = current?.label || 'Overview'
  const date = new Date()

  const dateStr = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(date)
  const subtitle = current?.to === '/review' ? (reviewCount === null ? 'waiting' : `${reviewCount} waiting`) : HEADER_SUBTITLE[current?.to ?? '']
  const topLine = subtitle ? `${dateStr} · ${subtitle}` : `${getGreeting(date)} · ${getDaysLeft(date)}`

  const handleSync = async () => {
    if (syncing) return
    setSyncing(true)
    setSyncError(null)
    try {
      await sendJson('POST', '/api/providers/sync', undefined, 120_000)
      void queryClient.invalidateQueries()
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

  const handleAsk = () => {
    if (!askText.trim()) return
    ask(askText.trim())
    setAskText('')
  }

  return (
    <HeaderView topLine={topLine} title={title}>
      {syncError && <span className="text-[12px] font-medium text-broken">{syncError}</span>}

      {current?.to !== '/assistant' && (
        <HeaderAskBox value={askText} onChange={setAskText} onSubmit={handleAsk} inputRef={inputRef} />
      )}

      <div className="flex flex-none gap-2">
        <HeaderButton title="Sync connections" label="Sync" disabled={syncing} onClick={() => void handleSync()}>
          <SyncIcon spinning={syncing} />
        </HeaderButton>

        <HeaderButton title="Hide amounts" label="Hide amounts" pressed={hiddenAmounts} onClick={toggleHiddenAmounts}>
          <HideAmountsIcon hidden={hiddenAmounts} />
        </HeaderButton>

        <HeaderButton title="Dark theme" label="Toggle theme" pressed={theme === 'dark'} onClick={toggleTheme}>
          <ThemeIcon />
        </HeaderButton>

        <Notifications />
      </div>
    </HeaderView>
  )
}
