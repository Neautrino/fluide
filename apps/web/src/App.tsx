import { useState } from 'react'
import { ConnectBank } from './components/ConnectBank'
import { TransactionList } from './components/TransactionList'
import { ReviewQueue } from './components/ReviewQueue'
import { Chat } from './components/Chat'

const PRINCIPLES = [
  {
    title: 'Read-only, always',
    body: 'Fluide never initiates a payment or transfer. Bank connections are strictly one-way — data in, nothing out.',
  },
  {
    title: 'True double-entry ledger',
    body: 'Every transaction is a balanced posting. Balances are always derived by replay, never stored as ground truth.',
  },
  {
    title: 'Self-hosted, your data',
    body: 'Runs on your own infrastructure. Credentials live in your deployment, never in a third-party cloud.',
  },
]

function App() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="relative min-h-svh overflow-hidden" style={{ background: 'var(--bg-canvas)' }}>
      {/* ambient glow — purely decorative, gives the dark canvas depth instead of flat void */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full opacity-[0.15] blur-[120px]"
        style={{ background: 'var(--accent)' }}
      />

      <header
        className="relative flex items-center justify-between px-6 py-4 sm:px-10"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            F
          </div>
          <span className="text-sm font-semibold tracking-tight">Fluide</span>
        </div>
        <span
          className="rounded-full px-3 py-1 text-xs font-medium"
          style={{ background: 'var(--bg-surface)', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)' }}
        >
          Sandbox
        </span>
      </header>

      <main className="relative mx-auto max-w-4xl px-6 py-12 sm:px-10 sm:py-20">
        <section className="mb-16">
          <h1
            className="text-4xl font-semibold tracking-tight sm:text-6xl"
            style={{ letterSpacing: '-0.02em' }}
          >
            Your money,
            <br />
            <span style={{ color: 'var(--text-tertiary)' }}>one true ledger.</span>
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Connect your accounts read-only, reconcile every transaction, and keep a real
            double-entry ledger — self-hosted, never write access to your bank.
          </p>
          <div className="mt-8">
            <ConnectBank onConnected={() => setRefreshKey((k) => k + 1)} />
          </div>
        </section>

        <section
          className="mb-10 rounded-2xl p-6 sm:p-8"
          style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)' }}
        >
          <TransactionList refreshKey={refreshKey} />
        </section>

        <section
          className="mb-10 rounded-2xl p-6 sm:p-8"
          style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)' }}
        >
          <ReviewQueue />
        </section>

        <section
          className="mb-10 rounded-2xl p-6 sm:p-8"
          style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)' }}
        >
          <Chat />
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <div
              key={p.title}
              className="rounded-xl p-5"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            >
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {p.title}
              </p>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>
                {p.body}
              </p>
            </div>
          ))}
        </section>

        <footer className="mt-16 pb-8 text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Fluide — self-hosted finance, built on Bun + Hono + React.
        </footer>
      </main>
    </div>
  )
}

export default App
