import { useQuery } from '@tanstack/react-query'
import { createContext, useContext } from 'react'
import { generalSettingsOptions } from './queries'

export type AppContextValue = {
  pendingQuestion: string | null
  ask: (question: string) => void
  clearPendingQuestion: () => void
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppContext.Provider>')
  return ctx
}

/** For the routes under the `currency` layout, which renders them only once the display currency is known. */
export function useDisplayCurrency(): string {
  const { data } = useQuery(generalSettingsOptions())
  if (!data) throw new Error('useDisplayCurrency used before settings loaded')
  return data.displayCurrency
}
