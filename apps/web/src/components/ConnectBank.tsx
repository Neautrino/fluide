import { useState, useCallback } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { Button } from './ui/Button'

/** SOURCE OF TRUTH: the Plaid Link enrollment widget trigger.
 * WHAT: fetches a link_token from the backend, opens Plaid's hosted widget,
 * and on success forwards the public_token to the backend for exchange.
 * WHY: this is the one place in apps/web that touches Plaid's enrollment
 * handshake — the component only ever holds link_token/public_token, both
 * short-lived and safe client-side. It never sees an access_token. The
 * connection is read-only: Fluide can never move money.
 * WHERE: owns the connect button + Link lifecycle only. Once exchange
 * succeeds it just calls onConnected(); rendering the result is the
 * parent's job (the Overview view).
 */

type Props = {
  onConnected: () => void
  variant?: 'primary' | 'secondary'
  showSandboxHint?: boolean
}

export function ConnectBank({ onConnected, variant = 'primary', showSandboxHint = true }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  const fetchLinkToken = useCallback(async () => {
    setStatus('loading')
    try {
      const res = await fetch('/api/providers/plaid/link-token', { method: 'POST' })
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
        const res = await fetch('/api/providers/plaid/exchange', {
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
    <div className="flex flex-col items-start gap-2">
      <Button variant={variant} onClick={handleClick} busy={status === 'loading'}>
        {status === 'loading' ? 'Connecting…' : 'Connect a US bank'}
      </Button>
      {status === 'error' && (
        <p role="alert" className="text-[13px] text-red">
          Couldn't start the bank connection. Check that the Fluide server is running, then try again.
        </p>
      )}
      {showSandboxHint && (
        <p className="text-[13px] text-ink-3">
          Sandbox: sign in with <code className="font-mono text-ink-2">user_good</code> /{' '}
          <code className="font-mono text-ink-2">pass_good</code>.
        </p>
      )}
    </div>
  )
}
