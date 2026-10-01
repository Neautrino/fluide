import { createContext, useContext } from 'react'
import type { GeneralSettings } from './api'
import type { Resource } from './useResource'

export type View = 'overview' | 'accounts' | 'cashflow' | 'transactions' | 'review' | 'rules' | 'assistant' | 'settings'

export type AppContextValue = {
  view: View
  navigate: (view: View) => void
  version: number
  invalidate: () => void
  /** Pending review items, null while unknown (loading or endpoint down). */
  reviewCount: number | null
  pendingQuestion: string | null
  ask: (question: string) => void
  clearPendingQuestion: () => void
  /** The display currency; null until settings load (or when they failed). */
  currency: string | null
  settings: Resource<GeneralSettings>
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppContext.Provider>')
  return ctx
}

/** For views App renders only once the display currency is known. */
export function useDisplayCurrency(): string {
  const { currency } = useApp()
  if (!currency) throw new Error('useDisplayCurrency used before settings loaded')
  return currency
}
