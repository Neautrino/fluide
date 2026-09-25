/** SOURCE OF TRUTH: the API credentials Fluide needs to talk to each
 * connector provider (Plaid client_id/secret, Enable Banking app_id + a
 * private-key file path) — entered once via the Settings screen, encrypted
 * at rest (vault.ts), one row per (tenant, provider) in provider_credentials.
 * WHAT: save/get per provider, plus a status check that never touches the
 * plaintext (the Settings screen's "configured: true/false, last updated").
 * WHY: Enable Banking's private key stays a file on disk (AGENTS.md — never
 * return a bank credential to apps/web); only appId and the keyPath string
 * are stored here, and keyPath is loaded as the signing key at save time
 * (loadEnableBankingKey) so a typo'd path, a directory or a non-PKCS#8 file
 * fails now, not on the next sync. Plaid's clientId/secret are
 * the real secret and get the same encrypted-blob treatment for
 * consistency, not because clientId itself needs hiding.
 * WHERE: owns the DB read/write only. Encryption is vault.ts's job;
 * building an actual Plaid/Enable Banking client from these values is
 * @repo/connectors' job (createPlaidConnector, and the *Credentials types
 * this file re-exports rather than redefining).
 */
import { and, eq } from 'drizzle-orm'
import { db, providerCredentials, type ConnectorProvider } from '@repo/ledger'
import { ConnectorError, loadEnableBankingKey, type PlaidCredentials, type EnableBankingCredentials } from '@repo/connectors'
import { encrypt, decrypt } from './vault.js'

function aad(tenantId: string, provider: ConnectorProvider) {
  return `${tenantId}:${provider}`
}

async function save(tenantId: string, provider: ConnectorProvider, fields: Record<string, string>) {
  const { ciphertext, nonce } = encrypt(JSON.stringify(fields), aad(tenantId, provider))
  const updatedAt = new Date()
  await db
    .insert(providerCredentials)
    .values({ tenantId, provider, fieldsCiphertext: ciphertext, fieldsNonce: nonce, updatedAt })
    .onConflictDoUpdate({
      target: [providerCredentials.tenantId, providerCredentials.provider],
      set: { fieldsCiphertext: ciphertext, fieldsNonce: nonce, updatedAt },
    })
}

async function get<T>(tenantId: string, provider: ConnectorProvider): Promise<T | undefined> {
  const [row] = await db
    .select()
    .from(providerCredentials)
    .where(and(eq(providerCredentials.tenantId, tenantId), eq(providerCredentials.provider, provider)))
    .limit(1)
  if (!row) return undefined
  const json = decrypt({ ciphertext: row.fieldsCiphertext, nonce: row.fieldsNonce }, aad(tenantId, provider))
  return JSON.parse(json) as T
}

export async function getProviderCredentialsStatus(
  tenantId: string,
  provider: ConnectorProvider,
): Promise<{ configured: boolean; updatedAt?: string }> {
  const [row] = await db
    .select({ updatedAt: providerCredentials.updatedAt })
    .from(providerCredentials)
    .where(and(eq(providerCredentials.tenantId, tenantId), eq(providerCredentials.provider, provider)))
    .limit(1)
  return row ? { configured: true, updatedAt: row.updatedAt.toISOString() } : { configured: false }
}

export async function savePlaidCredentials(
  tenantId: string,
  input: Partial<PlaidCredentials>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const clientId = input.clientId?.trim()
  const secret = input.secret?.trim()
  if (!clientId || !secret) return { ok: false, error: 'clientId and secret are both required' }
  await save(tenantId, 'plaid', { clientId, secret })
  return { ok: true }
}

export async function getPlaidCredentials(tenantId: string) {
  return get<PlaidCredentials>(tenantId, 'plaid')
}

export async function saveEnableBankingCredentials(
  tenantId: string,
  input: Partial<EnableBankingCredentials>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const appId = input.appId?.trim()
  const keyPath = input.keyPath?.trim()
  if (!appId || !keyPath) return { ok: false, error: 'appId and keyPath are both required' }
  try {
    await loadEnableBankingKey(keyPath)
  } catch (err) {
    if (err instanceof ConnectorError) return { ok: false, error: err.message }
    throw err
  }
  await save(tenantId, 'enable-banking', { appId, keyPath })
  return { ok: true }
}

export async function getEnableBankingCredentials(tenantId: string) {
  return get<EnableBankingCredentials>(tenantId, 'enable-banking')
}
