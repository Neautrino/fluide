/** SOURCE OF TRUTH: app-wide navigation + data-version signal.
 * WHAT: `navigate(view)` switches the active screen (plain React state, no
 * router); `version` increments via `invalidate()` after anything that
 * changes ledger data (connect, sync, categorize, approve, recategorize) so
 * every mounted view refetches.
 * WHERE: provided once by App.tsx.
 */

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
