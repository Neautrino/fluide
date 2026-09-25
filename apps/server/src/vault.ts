/** SOURCE OF TRUTH: the one AES-256-GCM encrypt/decrypt boundary for every
 * secret this server persists (provider API credentials in
 * provider-credentials.ts; per-connection bank tokens in
 * connection-store.ts, unchanged for now).
 * WHAT: encrypt(plaintext, aad) -> {ciphertext, nonce} (base64 strings, DB-
 * column-friendly); decrypt reverses it and throws if the key, aad, or
 * ciphertext don't all match (GCM authentication failure — tampered or
 * mismatched data is refused, never silently returned garbage).
 * WHY: FLUIDE_VAULT_KEY is the single master key (32 random bytes, base64,
 * generated once via `openssl rand -base64 32`, kept outside the repo —
 * same shape as n8n's N8N_ENCRYPTION_KEY, the closest real precedent for a
 * self-hosted single-tenant tool). A fresh random 12-byte nonce is drawn
 * per encryption call — GCM nonce reuse under the same key leaks the
 * authentication subkey and breaks confidentiality, so nonces are never
 * cached, derived, or reused (OWASP Cryptographic Storage Cheat Sheet).
 * `aad` binds a ciphertext to the row it belongs to (callers pass e.g.
 * `${tenantId}:${provider}`) so one row's ciphertext can never be copied
 * into another row's column and still decrypt.
 * WHERE: owns encryption only. What gets encrypted and which table it
 * lands in is provider-credentials.ts's job. The key itself is never
 * logged, returned to apps/web, or read by anything but this file.
 */
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const NONCE_LENGTH = 12
const AUTH_TAG_LENGTH = 16

let cachedKey: Buffer | undefined

function key(): Buffer {
  if (cachedKey) return cachedKey
  const raw = process.env.FLUIDE_VAULT_KEY
  if (!raw) {
    throw new Error('FLUIDE_VAULT_KEY must be set (openssl rand -base64 32) before any credential can be stored or read')
  }
  const decoded = Buffer.from(raw, 'base64')
  if (decoded.length !== 32) throw new Error('FLUIDE_VAULT_KEY must decode to exactly 32 bytes (openssl rand -base64 32)')
  cachedKey = decoded
  return decoded
}

export type Encrypted = { ciphertext: string; nonce: string }

export function encrypt(plaintext: string, aad: string): Encrypted {
  const nonce = randomBytes(NONCE_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key(), nonce)
  cipher.setAAD(Buffer.from(aad, 'utf8'))
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final(), cipher.getAuthTag()])
  return { ciphertext: ciphertext.toString('base64'), nonce: nonce.toString('base64') }
}

export function decrypt(encrypted: Encrypted, aad: string): string {
  const nonce = Buffer.from(encrypted.nonce, 'base64')
  const combined = Buffer.from(encrypted.ciphertext, 'base64')
  const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH)
  const ciphertext = combined.subarray(0, combined.length - AUTH_TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key(), nonce)
  decipher.setAAD(Buffer.from(aad, 'utf8'))
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
