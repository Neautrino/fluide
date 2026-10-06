import { useQuery } from '@tanstack/react-query'
import { Link, Outlet, useNavigate, useRouter, useRouterState, type ErrorComponentProps } from '@tanstack/react-router'
import { useCallback, useMemo, useState } from 'react'
import { EnableBankingCallback } from './components/EnableBankingCallback'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { Empty, ErrorState, Loading } from '@repo/ui/primitives'
import { AppWindow } from '@repo/ui/shell'
import { errorMessage } from './lib/api'
import { AppContext } from './lib/app-context'
import { generalSettingsOptions, queryError } from './lib/queries'
import { Assistant } from './views/Assistant'

export function RootLayout() {
  const navigate = useNavigate()
  const outletKey = useRouterState({ select: (state) => state.matches[state.matches.length - 1]?.pathname ?? '' })
  const onAssistant = useRouterState({ select: (state) => state.matches[state.matches.length - 1]?.routeId === '/assistant' })
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null)

  const ask = useCallback(
    (question: string) => {
      setPendingQuestion(question)
      void navigate({ to: '/assistant' })
    },
    [navigate],
  )
  const clearPendingQuestion = useCallback(() => setPendingQuestion(null), [])
  const ctx = useMemo(
    () => ({ pendingQuestion, ask, clearPendingQuestion }),
    [pendingQuestion, ask, clearPendingQuestion],
  )

  return (
    <AppContext.Provider value={ctx}>
      <AppWindow sidebar={<Sidebar />}>
        <Header />
        <EnableBankingCallback />
        {!onAssistant && (
          <div key={outletKey} className="animate-rise flex min-w-0 flex-1 flex-col">
            <Outlet />
          </div>
        )}
        <div hidden={!onAssistant} className="min-w-0">
          <Assistant visible={onAssistant} />
        </div>
      </AppWindow>
    </AppContext.Provider>
  )
}

export function CurrencyGate() {
  const settings = useQuery(generalSettingsOptions())
  if (settings.isError)
    return (
      <ErrorState
        title="Couldn't load your display currency"
        message={queryError(settings)}
        onRetry={() => void settings.refetch()}
      />
    )
  if (!settings.data?.displayCurrency) return <Loading label="Loading settings" rows={6} />
  return <Outlet />
}

export function NotFound() {
  return (
    <Empty title="Page not found">
      That address is not part of Fluide.{' '}
      <Link to="/" className="font-medium underline underline-offset-2">
        Go to the Overview
      </Link>
      .
    </Empty>
  )
}

export function ErrorScreen({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  return (
    <ErrorState
      title="Something went wrong"
      message={errorMessage(error)}
      onRetry={() => {
        reset()
        void router.invalidate()
      }}
    />
  )
}
