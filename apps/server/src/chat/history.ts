/* SOURCE OF TRUTH: saved assistant conversations (chat_threads, chat_messages).
 * Invariant: titles and contents are stored only encrypted; threads not updated for 30 days are deleted.
 * Never: return another tenant's thread or send stored history to any provider but the configured chat model.
 * See: ADR 042 — chat history kept 30 days
 */
import { and, asc, desc, eq, lt, sql } from 'drizzle-orm'
import { db, chatMessages, chatThreads } from '@repo/ledger'
import type { ChatRole } from '@repo/ledger'
import { encrypt, decrypt } from '../vault.js'

const RETENTION = sql`now() - interval '30 days'`
const TITLE_MAX = 80

export type ThreadSummary = { id: string; title: string; updatedAt: string; questions: number }
export type ThreadMessage = { role: ChatRole; content: string; at: string }
export type Thread = { id: string; title: string; messages: ThreadMessage[] }

const titleAad = (tenantId: string, threadId: string) => `${tenantId}:chat-title:${threadId}`
const messageAad = (tenantId: string, threadId: string, seq: number) => `${tenantId}:chat:${threadId}:${seq}`

/** The retention rule: called on list and append, since no scheduler exists. */
export async function purgeExpired(tenantId: string): Promise<void> {
  await db.delete(chatThreads).where(and(eq(chatThreads.tenantId, tenantId), lt(chatThreads.updatedAt, RETENTION)))
}

export async function listThreads(tenantId: string): Promise<ThreadSummary[]> {
  await purgeExpired(tenantId)
  const rows = await db
    .select({
      id: chatThreads.id,
      titleCiphertext: chatThreads.titleCiphertext,
      titleNonce: chatThreads.titleNonce,
      updatedAt: chatThreads.updatedAt,
      questions: sql<number>`count(${chatMessages.id}) filter (where ${chatMessages.role} = 'user')`.mapWith(Number),
    })
    .from(chatThreads)
    .leftJoin(chatMessages, eq(chatMessages.threadId, chatThreads.id))
    .where(eq(chatThreads.tenantId, tenantId))
    .groupBy(chatThreads.id)
    .orderBy(desc(chatThreads.updatedAt))
  return rows.map((row) => ({
    id: row.id,
    title: decrypt({ ciphertext: row.titleCiphertext, nonce: row.titleNonce }, titleAad(tenantId, row.id)),
    updatedAt: row.updatedAt.toISOString(),
    questions: row.questions,
  }))
}

export async function getThread(tenantId: string, id: string): Promise<Thread | null> {
  const [thread] = await db
    .select()
    .from(chatThreads)
    .where(and(eq(chatThreads.id, id), eq(chatThreads.tenantId, tenantId), sql`${chatThreads.updatedAt} >= ${RETENTION}`))
  if (!thread) return null
  const rows = await db.select().from(chatMessages).where(eq(chatMessages.threadId, id)).orderBy(asc(chatMessages.seq))
  return {
    id,
    title: decrypt({ ciphertext: thread.titleCiphertext, nonce: thread.titleNonce }, titleAad(tenantId, id)),
    messages: rows.map((row) => ({
      role: row.role,
      content: decrypt({ ciphertext: row.contentCiphertext, nonce: row.contentNonce }, messageAad(tenantId, id, row.seq)),
      at: row.createdAt.toISOString(),
    })),
  }
}

/** Saves one question + answer; creates the thread (titled from the question) on first use. */
export async function appendExchange(tenantId: string, threadId: string, question: string, answer: string): Promise<{ id: string; title: string }> {
  await purgeExpired(tenantId)
  return db.transaction(async (tx) => {
    const title = question.replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX)
    const encryptedTitle = encrypt(title, titleAad(tenantId, threadId))
    await tx
      .insert(chatThreads)
      .values({ id: threadId, tenantId, titleCiphertext: encryptedTitle.ciphertext, titleNonce: encryptedTitle.nonce })
      .onConflictDoNothing({ target: chatThreads.id })
    // The row lock serialises concurrent appends to one thread, so seqs never collide.
    const [thread] = await tx
      .select()
      .from(chatThreads)
      .where(and(eq(chatThreads.id, threadId), eq(chatThreads.tenantId, tenantId)))
      .for('update')
    if (!thread) throw new Error('chat thread belongs to another tenant')
    const [last] = await tx
      .select({ maxSeq: sql<number>`coalesce(max(${chatMessages.seq}), -1)`.mapWith(Number) })
      .from(chatMessages)
      .where(eq(chatMessages.threadId, threadId))
    const nextSeq = (last?.maxSeq ?? -1) + 1
    const turns: [ChatRole, string][] = [['user', question], ['assistant', answer]]
    await tx.insert(chatMessages).values(
      turns.map(([role, content], i) => {
        const seq = nextSeq + i
        const encrypted = encrypt(content, messageAad(tenantId, threadId, seq))
        return { threadId, seq, role, contentCiphertext: encrypted.ciphertext, contentNonce: encrypted.nonce }
      }),
    )
    await tx.update(chatThreads).set({ updatedAt: sql`now()` }).where(eq(chatThreads.id, threadId))
    return {
      id: threadId,
      title: decrypt({ ciphertext: thread.titleCiphertext, nonce: thread.titleNonce }, titleAad(tenantId, threadId)),
    }
  })
}

export async function deleteThread(tenantId: string, id: string): Promise<boolean> {
  const deleted = await db
    .delete(chatThreads)
    .where(and(eq(chatThreads.id, id), eq(chatThreads.tenantId, tenantId)))
    .returning({ id: chatThreads.id })
  return deleted.length > 0
}

export async function deleteAllThreads(tenantId: string): Promise<number> {
  const deleted = await db.delete(chatThreads).where(eq(chatThreads.tenantId, tenantId)).returning({ id: chatThreads.id })
  return deleted.length
}
