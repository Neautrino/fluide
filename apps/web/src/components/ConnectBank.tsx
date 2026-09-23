import { useState, useCallback } from 'react'
import { usePlaidLink } from 'react-plaid-link'

/** SOURCE OF TRUTH: the Plaid Link enrollment widget trigger.
 * WHAT: fetches a link_token from the backend, opens Plaid's hosted widget,
 * and on success forwards the public_token to the backend for exchange.
 * WHY: this is the one place in apps/web that touches Plaid's enrollment
 * handshake — the component only ever holds link_token/public_token, both
 * short-lived and safe client-side. It never sees an access_token.
 * WHERE: owns the connect button + Link lifecycle only. Once exchange
 * succeeds it just calls onConnected(); rendering the result is the
 * parent's job (App.tsx).
 */

type Props = {
  onConnected: () => void
}

export function ConnectBank({ onConnected }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  const fetchLinkToken = useCallback(async () => {
    setStatus('loading')
    try {
      const res = await fetch('/plaid/link-token', { method: 'POST' })
      if (!res.ok) throw new Error('link-token request failed')
      const data = await res.json()
      setLinkToken(data.link_token)
      setStatus('idle')
    } catch {
      setStatus('error')
    }
  }, [])

  const { open, ready } = usePlaidLink({
    token: linkToken ?? '',
    onSuccess: async (public_token) => {
      setStatus('loading')
      try {
        const res = await fetch('/plaid/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_token }),
        })
        if (!res.ok) throw new Error('exchange failed')
        onConnected()
        setStatus('idle')
      } catch {
        setStatus('error')
      }
    },
  })

  const handleClick = async () => {
    if (!linkToken) {
      await fetchLinkToken()
      return
    }
    open()
  }

  // once a fresh token arrives and Link is ready, open it immediately
  if (linkToken && ready && status === 'idle') {
    open()
    setLinkToken(null) // consume — Plaid link_tokens are single-use
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === 'loading'}
        className="rounded-lg px-5 py-3 text-sm font-medium text-white transition disabled:opacity-50"
        style={{ background: 'var(--accent)' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}
      >
        {status === 'loading' ? 'Connecting…' : 'Connect a bank account'}
      </button>
      {status === 'error' && (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>
          Something went wrong. Check the server is running on :4000 and try again.
        </p>
      )}
      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        Sandbox mode — use{' '}
        <code className="font-mono" style={{ color: 'var(--text-secondary)' }}>
          user_good
        </code>{' '}
        /{' '}
        <code className="font-mono" style={{ color: 'var(--text-secondary)' }}>
          pass_good
        </code>{' '}
        at the Plaid login screen.
      </p>
    </div>
  )
}
