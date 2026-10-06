import type { ConnectionSummary } from './api'

export const HTTPS_REASON =
  'Needs https — banks only redirect back to https addresses. Open Fluide over https (WEB_TLS_CERT_PATH and WEB_TLS_KEY_PATH in apps/web/.env).'

export const isHttps = () => window.location.protocol === 'https:'

export const HTTPS_REASON_ID = 'accounts-https-reason'

/** Enable Banking only sends the user back to https addresses, so its Renew/Reconnect is off while Fluide is served over http. */
export const blocksReconnect = (c: Pick<ConnectionSummary, 'provider'>) => c.provider === 'enable-banking' && !isHttps()
