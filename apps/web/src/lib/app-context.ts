import { createContext, useContext } from 'react'

export type View = 'overview' | 'transactions' | 'review' | 'rules' | 'assistant' | 'settings'

export type AppContextValue = {
  view: View
  navigate: (view: View) => void
  version: number
  invalidate: () => void
  /** Pending review items, null while unknown (loading or endpoint down). */
  reviewCount: number | null
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppContext.Provider>')
  return ctx
}
