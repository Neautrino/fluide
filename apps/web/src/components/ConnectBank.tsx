import { useCallback, useEffect, useRef, useState } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { duplicateLinkOf, errorMessage, sendJson, type DuplicateLink, type SyncOutcome } from '../lib/api'
import { formatTimestamp } from '../lib/format'
import { SyncNotice } from './SyncNotice'
import { Button } from './ui/Button'
import { Notice } from './ui/States'

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
  const [duplicate, setDuplicate] = useState<DuplicateLink | null>(null)
  const [updateOf, setUpdateOf] = useState<string | null>(null)
  const [replaces, setReplaces] = useState<string | null>(null)
  const opened = useRef<string | null>(null)

  /** `update` opens Link on an existing Item (same login, keeps history);
   * `answer` tells the exchange what a second login at a known bank is. */
  const start = useCallback(async (update: string | null, answer: string | null) => {
    setBusy(true)
    setError(null)
    setOutcome(null)
    setDuplicate(null)
    setUpdateOf(update)
    setReplaces(answer)
    try {
      const token = update
        ? (await sendJson<{ plaidLinkToken: string }>('POST', `/api/providers/connections/${update}/reconnect`)).plaidLinkToken
        : (await sendJson<{ link_token: string }>('POST', '/api/providers/plaid/link-token')).link_token
      setLinkToken(token)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setBusy(false)
    }
  }, [])

  const { open, ready } = usePlaidLink({
    token: linkToken ?? '',
    onSuccess: async (public_token) => {
      setBusy(true)
      try {
        const { sync } = updateOf
          ? await sendJson<{ sync: SyncOutcome }>('POST', `/api/providers/connections/${updateOf}/sync`, undefined, SYNC_TIMEOUT_MS)
          : await sendJson<{ sync: SyncOutcome }>(
              'POST',
              '/api/providers/plaid/exchange',
              { public_token, replaces: replaces ?? undefined },
              SYNC_TIMEOUT_MS,
            )
        setOutcome(sync)
        onConnected()
      } catch (e) {
        const alreadyLinked = duplicateLinkOf(e)
        if (alreadyLinked) setDuplicate(alreadyLinked)
        else setError(errorMessage(e))
      } finally {
        setBusy(false)
      }
    },
  })

  /** Each token is opened once, after the commit that made Link ready.
   * The token stays in state: react-plaid-link force-exits and destroys the
   * handler whenever the token changes, which would close the open dialog. */
  useEffect(() => {
    if (linkToken && ready && !busy && opened.current !== linkToken) {
      opened.current = linkToken
      open()
    }
  }, [linkToken, ready, busy, open])

  return (
    <div className="flex flex-col items-start gap-2">
      <Button variant={variant} size={size} onClick={() => void start(reconnectId ?? null, null)} busy={busy}>
        {busy ? 'Connecting…' : reconnectId ? 'Reconnect' : 'Connect a US bank'}
      </Button>
      {duplicate && <DuplicateChoice duplicate={duplicate} onChoose={start} onCancel={() => setDuplicate(null)} />}
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

function DuplicateChoice({
  duplicate,
  onChoose,
  onCancel,
}: {
  duplicate: DuplicateLink
  onChoose: (update: string | null, answer: string | null) => void
  onCancel: () => void
}) {
  const bank = duplicate.institutionName ?? 'this bank'
  return (
    <Notice tone="info">
      <p className="font-medium text-ink">You're already connected to {bank}.</p>
      <p className="mt-0.5">
        Reconnect that login to keep your history, or connect it again as a second login. Nothing was imported.
      </p>
      <div className="mt-2.5 flex flex-col gap-2">
        {duplicate.logins.map((login) => (
          <div key={login.id} className="flex flex-wrap items-center gap-2">
            <span className="figures">
              {login.status === 'disconnected'
                ? 'Disconnected login'
                : login.lastSyncedAt
                  ? `Last synced ${formatTimestamp(login.lastSyncedAt)}`
                  : 'Never synced'}
            </span>
            {login.status !== 'disconnected' && (
              <Button size="sm" onClick={() => onChoose(login.id, null)}>
                Reconnect it
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => onChoose(null, login.id)}>
              This one replaces it
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => onChoose(null, 'new')}>
            It's a different login at {bank}
          </Button>
          <Button size="sm" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </Notice>
  )
}
