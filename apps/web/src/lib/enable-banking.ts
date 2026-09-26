import { sendJson, errorMessage } from './api'

export const ENABLE_BANKING_CALLBACK_PATH = '/connect/enable-banking/callback'

export type EnableBankingBank = { name: string; country: string; logo?: string; beta: boolean }

export type ConnectedSummary = {
  institutionName: string
  validUntil: string
  accountsAuthorized: number
  ingest: { accountsSeen: number; transactionsInserted: number; transactionsSkipped: number }
}

export type CallbackOutcome = { ok: true; summary: ConnectedSummary } | { ok: false; message: string }

// Ingest runs inside the session call and fetches the longest history the
// bank offers, so allow far more than the default request deadline.
const SESSION_TIMEOUT_MS = 180_000

export async function startEnableBankingConnect(bank: EnableBankingBank) {
  const { url } = await sendJson<{ url: string }>('POST', '/api/providers/enable-banking/auth', {
    aspspName: bank.name,
    country: bank.country,
  })
  window.location.assign(url)
}

let consumed: Promise<CallbackOutcome> | null = null

/** Returns the outcome of this page load's bank callback, or null when the
 * page was not opened by a bank redirect. Safe to call more than once.
 * Runs at module level, not in an effect: the code is single-use and
 * StrictMode runs effects twice. The URL is cleaned at once. */
export function consumeEnableBankingCallback(): Promise<CallbackOutcome> | null {
  if (consumed) return consumed
  if (window.location.pathname !== ENABLE_BANKING_CALLBACK_PATH) return null

  const params = new URLSearchParams(window.location.search)
  window.history.replaceState(null, '', '/')
  const code = params.get('code')
  const state = params.get('state')
  const bankError = params.get('error_description') ?? params.get('error')

  if (bankError || !code || !state) {
    consumed = Promise.resolve({
      ok: false,
      message: bankError ? `The bank did not grant access: ${bankError}` : 'The bank redirect had no authorization code.',
    })
    return consumed
  }

  consumed = sendJson<ConnectedSummary>('POST', '/api/providers/enable-banking/session', { code, state }, SESSION_TIMEOUT_MS).then(
    (summary): CallbackOutcome => ({ ok: true, summary }),
    (e): CallbackOutcome => ({ ok: false, message: errorMessage(e) }),
  )
  return consumed
}
