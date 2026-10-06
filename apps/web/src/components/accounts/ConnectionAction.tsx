import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { errorMessage, sendJson, type ConnectionSummary } from '../../lib/api'
import { shortName, type Health } from '@repo/ui/connection-health'
import { bankRedirectUrl } from '../../lib/enable-banking'
import { ConnectBank } from '../ConnectBank'
import { Button } from '@repo/ui/primitives'
import { blocksReconnect, HTTPS_REASON_ID } from '../../lib/https'

/**
 * What to do about a connection that needs attention. A failed sync is fixed from Settings (this page has no Sync);
 * otherwise Plaid opens Link in update mode, and Enable Banking starts a new authorization at the same bank, which needs https.
 */
export function ConnectionAction({ connection: c, health, onSettings }: { connection: ConnectionSummary; health: Health; onSettings: () => void }) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const label = health.actions.reconnect

  if (health.state === 'error') {
    return (
      <button type="button" onClick={onSettings} className="text-[12.5px] font-medium whitespace-nowrap text-ink-2 hover:text-ink">
        Sync in Settings ›
      </button>
    )
  }
  if (!label) return null

  const text = `${label} ${shortName(c.institutionName ?? 'bank')}`
  const variant = health.severity === 'broken' ? 'danger' : 'secondary'

  if (c.provider === 'plaid') {
    return (
      <ConnectBank
        reconnectId={c.id}
        onConnected={() => void queryClient.invalidateQueries()}
        renderTrigger={(t) => (
          <Button size="sm" variant={variant} busy={t.busy} aria-label={t.busy ? undefined : text} onClick={t.onClick}>
            {t.busy ? t.label : text}
          </Button>
        )}
      />
    )
  }

  const blocked = blocksReconnect(c)
  const go = async () => {
    setBusy(true)
    setError(null)
    try {
      const { redirectUrl } = await sendJson<{ redirectUrl: string }>('POST', `/api/providers/connections/${c.id}/reconnect`)
      window.location.assign(bankRedirectUrl(redirectUrl))
    } catch (e) {
      setError(errorMessage(e))
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        size="sm"
        variant={variant}
        busy={busy}
        disabled={blocked}
        aria-label={busy ? undefined : text}
        aria-describedby={blocked ? HTTPS_REASON_ID : undefined}
        onClick={() => void go()}
      >
        {busy ? 'Opening bank…' : text}
      </Button>
      {error && (
        <p role="alert" className="text-[12px] text-broken">
          {error}
        </p>
      )}
    </div>
  )
}
