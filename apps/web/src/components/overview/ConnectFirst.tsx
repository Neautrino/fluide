import { ConnectBank } from '../ConnectBank'
import { ConnectEuropeanBank } from '../ConnectEuropeanBank'

export function ConnectFirst({ onConnected }: { onConnected: () => void }) {
  return (
    <section className="grid grid-cols-1 gap-8 border-y border-line py-10 md:grid-cols-12">
      <div className="md:col-span-7">
        <p className="eyebrow mb-3">Getting started</p>
        <h2 className="text-[34px] leading-tight text-ink">Connect your first account.</h2>
        <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-ink-2">
          Fluide links to your bank through Plaid (US) with read-only access, imports
          your transactions into a double-entry ledger on your own server, and never has permission to move money.
        </p>
        <div className="mt-6 flex flex-col items-start gap-3">
          <ConnectBank onConnected={onConnected} />
          <ConnectEuropeanBank variant="secondary" />
        </div>
      </div>
      <ul className="flex flex-col gap-4 text-sm text-ink-2 md:col-span-5 md:border-l md:border-line md:pl-8">
        <li>
          <p className="font-medium text-ink">Read-only by design</p>
          No payments, no transfers — the connection only reads.
        </li>
        <li>
          <p className="font-medium text-ink">Balanced, auditable ledger</p>
          Every transaction is a posting pair that sums to zero.
        </li>
        <li>
          <p className="font-medium text-ink">Your server, your data</p>
          Credentials stay in your deployment.
        </li>
      </ul>
    </section>
  )
}
