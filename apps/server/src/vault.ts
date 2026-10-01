/* SOURCE OF TRUTH: the AES-256-GCM encrypt/decrypt boundary for DB-stored secrets.
 * Invariant: a fresh random nonce per encrypt(), never cached or derived; aad binds a ciphertext to its row.
 * Never: log or return FLUIDE_VAULT_KEY; no other file reads it.
 * See: ADR 009 — why one master key, not envelope encryption or an external vault
 */
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import { secretEnv } from '@repo/ledger'

const ALGORITHM = 'aes-256-gcm'
const NONCE_LENGTH = 12
const AUTH_TAG_LENGTH = 16

let cachedKey: Buffer | undefined

function key(): Buffer {
  if (cachedKey) return cachedKey
  const raw = secretEnv('FLUIDE_VAULT_KEY')
  if (!raw) {
    throw new Error('FLUIDE_VAULT_KEY or FLUIDE_VAULT_KEY_FILE must be set (openssl rand -base64 32) before any credential can be stored or read')
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
