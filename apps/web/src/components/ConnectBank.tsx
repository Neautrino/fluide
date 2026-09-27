import { useState, useCallback } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { errorMessage, sendJson, type SyncOutcome } from '../lib/api'
import { SyncNotice } from './SyncNotice'
import { Button } from './ui/Button'

type Props = {
  onConnected: () => void
  variant?: 'primary' | 'secondary'
  size?: 'sm'
  showSandboxHint?: boolean
  /** Opens Plaid Link in update mode for this connection instead of adding a new bank. */
  reconnectId?: string
}

const SYNC_TIMEOUT_MS = 120_000

export function ConnectBank({ onConnected, variant = 'primary', size, showSandboxHint = true, reconnectId }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<SyncOutcome | null>(null)

  const fetchLinkToken = useCallback(async () => {
    setBusy(true)
    setError(null)
    setOutcome(null)
    try {
      const path = reconnectId ? `/api/providers/connections/${reconnectId}/link-token` : '/api/providers/plaid/link-token'
      const { link_token } = await sendJson<{ link_token: string }>('POST', path)
      setLinkToken(link_token)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }, [reconnectId])

  const { open, ready } = usePlaidLink({
    token: linkToken ?? '',
    onSuccess: async (public_token) => {
      setBusy(true)
      try {
        const { sync } = reconnectId
          ? await sendJson<{ sync: SyncOutcome }>('POST', `/api/providers/connections/${reconnectId}/sync`, undefined, SYNC_TIMEOUT_MS)
          : await sendJson<{ sync: SyncOutcome }>('POST', '/api/providers/plaid/exchange', { public_token }, SYNC_TIMEOUT_MS)
        setOutcome(sync)
        onConnected()
      } catch (e) {
        setError(errorMessage(e))
      } finally {
        setBusy(false)
      }
    },
  })

  // once a fresh token arrives and Link is ready, open it immediately
  if (linkToken && ready && !busy) {
    open()
    setLinkToken(null) // consume — Plaid link_tokens are single-use
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant={variant} size={size} onClick={() => void fetchLinkToken()} busy={busy}>
        {busy ? 'Connecting…' : reconnectId ? 'Reconnect' : 'Connect a US bank'}
      </Button>
      {error && (
        <p role="alert" className="text-[13px] text-red">
          {error}
        </p>
      )}
      {outcome && <SyncNotice outcomes={[outcome]} />}
      {showSandboxHint && !reconnectId && (
        <p className="text-[13px] text-ink-3">
          Sandbox: sign in with <code className="font-mono text-ink-2">user_good</code> /{' '}
          <code className="font-mono text-ink-2">pass_good</code>.
        </p>
      )}
    </div>
  )
}
