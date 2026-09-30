import { useCallback, useMemo, useState, type ComponentType } from 'react'
import { EnableBankingCallback } from './components/EnableBankingCallback'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { getJson, type ReviewItem } from './lib/api'
import { AppContext, type View } from './lib/app-context'
import { useResource } from './lib/useResource'
import { Accounts } from './views/Accounts'
import { Assistant } from './views/Assistant'
import { CashFlow } from './views/CashFlow'
import { Overview } from './views/Overview'
import { Review } from './views/Review'
import { Rules } from './views/Rules'
import { Settings } from './views/Settings'
import { Transactions } from './views/Transactions'

const VIEWS: Record<Exclude<View, 'assistant'>, ComponentType> = {
  overview: Overview,
  accounts: Accounts,
  cashflow: CashFlow,
  transactions: Transactions,
  review: Review,
  rules: Rules,
  settings: Settings,
}

function App() {
  const [view, setView] = useState<View>('overview')
  const [version, setVersion] = useState(0)
  const [visit, setVisit] = useState(0)
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null)

  const navigate = useCallback((next: View) => {
    setView(next)
    setVisit((n) => n + 1)
    window.scrollTo({ top: 0 })
  }, [])

  const ask = useCallback((q: string) => {
    setPendingQuestion(q)
    navigate('assistant')
  }, [navigate])

  const clearPendingQuestion = useCallback(() => setPendingQuestion(null), [])

  const invalidate = useCallback(() => setVersion((v) => v + 1), [])
  const queue = useResource(
    (signal) => getJson<{ items: ReviewItem[] }>('/api/assistant/review-queue', signal).then((r) => r.items.length),
    version,
  )
  const reviewCount = queue.data ?? null

  const ctx = useMemo(
    () => ({ view, navigate, version, invalidate, reviewCount, pendingQuestion, ask, clearPendingQuestion }),
    [view, navigate, version, invalidate, reviewCount, pendingQuestion, ask, clearPendingQuestion],
  )

  const ActiveView = view === 'assistant' ? null : VIEWS[view]

  return (
    <AppContext.Provider value={ctx}>
      <div className="min-h-svh bg-canvas md:p-6">
        <div className="mx-auto flex min-h-svh flex-col overflow-hidden bg-surface md:min-h-[852px] md:max-w-[1392px] md:grid md:grid-cols-[232px_minmax(0,1fr)] md:rounded-xl md:border md:border-line md:shadow-2">
          <Sidebar view={view} onNavigate={navigate} reviewCount={reviewCount} />
          <main className="flex min-w-0 flex-col gap-5 px-[28px] pb-[30px]">
            <Header />
            <EnableBankingCallback />
            {ActiveView && (
              <div key={`${view}:${visit}`} className="animate-rise min-w-0">
                <ActiveView />
              </div>
            )}
            <div hidden={view !== 'assistant'} className="min-w-0">
              <Assistant />
            </div>
          </main>
        </div>
      </div>
    </AppContext.Provider>
  )
}

export default App
