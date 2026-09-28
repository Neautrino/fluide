import { useCallback, useMemo, useState, type ComponentType } from 'react'
import { EnableBankingCallback } from './components/EnableBankingCallback'
import { Sidebar } from './components/Sidebar'
import { Accounts } from './views/Accounts'
import { getJson, type ReviewItem } from './lib/api'
import { AppContext, type View } from './lib/app-context'
import { useResource } from './lib/useResource'
import { Assistant } from './views/Assistant'
import { Overview } from './views/Overview'
import { Review } from './views/Review'
import { Rules } from './views/Rules'
import { Settings } from './views/Settings'
import { Transactions } from './views/Transactions'

const VIEWS: Record<Exclude<View, 'assistant'>, ComponentType> = {
  overview: Overview,
  accounts: Accounts,
  transactions: Transactions,
  review: Review,
  rules: Rules,
  settings: Settings,
}

function App() {
  const [view, setView] = useState<View>('overview')
  const [version, setVersion] = useState(0)

  const navigate = useCallback((next: View) => {
    setView(next)
    window.scrollTo({ top: 0 })
  }, [])
  const invalidate = useCallback(() => setVersion((v) => v + 1), [])
  const queue = useResource(
    (signal) => getJson<{ items: ReviewItem[] }>('/api/assistant/review-queue', signal).then((r) => r.items.length),
    version,
  )
  const reviewCount = queue.data ?? null
  const ctx = useMemo(
    () => ({ view, navigate, version, invalidate, reviewCount }),
    [view, navigate, version, invalidate, reviewCount],
  )

  const ActiveView = view === 'assistant' ? null : VIEWS[view]

  return (
    <AppContext.Provider value={ctx}>
      <div className="flex min-h-svh flex-col md:flex-row">
        <Sidebar view={view} onNavigate={navigate} reviewCount={reviewCount} />
        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1120px] px-5 pt-8 pb-20 md:px-12 md:pt-12">
            <EnableBankingCallback />
            {ActiveView && (
              <div key={view} className="animate-rise">
                <ActiveView />
              </div>
            )}
            <div hidden={view !== 'assistant'}>
              <Assistant />
            </div>
          </div>
        </main>
      </div>
    </AppContext.Provider>
  )
}

export default App
