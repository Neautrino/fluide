import { Hono } from 'hono'
import { listCategorizationRules, listPendingReviewItems, getGateSettings } from '@repo/ledger'
import { LOCAL_TENANT_ID } from '../ingest.js'
import { askAgent } from '../chat/agent.js'
import { categorizeUncategorizedPostings } from '../categorization/categorize.js'
import { createUserRule, setRuleStatus } from '../categorization/rules.js'
import { resolveReviewItem } from '../review.js'
import { saveGateSettings, type GateSettingsInput } from '../settings.js'
import { isUuid, uuidParam } from './validate.js'

export const assistantRoutes = new Hono()

// --- Chat Agent ---

assistantRoutes.post('/chat', async (c) => {
  const body = await c.req.json<{ message: string; threadId: string }>().catch(() => null)
  if (!body) return c.json({ error: 'body must be JSON' }, 400)
  if (!body?.message?.trim() || !body?.threadId) {
    return c.json({ error: 'message and threadId are required' }, 400)
  }
  try {
    const reply = await askAgent(body.message, body.threadId)
    return c.json(reply)
  } catch (err) {
    console.error('chat error', err)
    return c.json({ error: 'failed to get a reply' }, 500)
  }
})

// --- Categorization Batch Run ---

assistantRoutes.post('/categorize', async (c) => {
  const result = await categorizeUncategorizedPostings(LOCAL_TENANT_ID)
  return c.json({ result })
})

// --- Categorization Rules ---

assistantRoutes.get('/rules', async (c) => {
  return c.json({ rules: await listCategorizationRules(LOCAL_TENANT_ID) })
})

assistantRoutes.post('/rules', async (c) => {
  const body = await c.req.json<{ pattern?: string; categoryId?: string }>().catch(() => null)
  if (!body) return c.json({ error: 'body must be JSON' }, 400)
  if (!body.pattern?.trim() || !body.categoryId) {
    return c.json({ error: 'pattern and categoryId are required' }, 400)
  }
  if (!isUuid(body.categoryId)) return c.json({ error: 'categoryId must be a UUID' }, 400)
  const result = await createUserRule(LOCAL_TENANT_ID, body.pattern.trim(), body.categoryId)
  if (!result.ok) return c.json({ error: result.error }, result.status)
  return c.json({ rule: result.rule })
})

assistantRoutes.post('/rules/:id/activate', uuidParam('id'), async (c) => {
  const result = await setRuleStatus(c.req.param('id'), 'active')
  if (!result.ok) return c.json({ error: result.error }, result.status)
  return c.json({ rule: result.rule })
})

assistantRoutes.post('/rules/:id/reject', uuidParam('id'), async (c) => {
  const result = await setRuleStatus(c.req.param('id'), 'rejected')
  if (!result.ok) return c.json({ error: result.error }, result.status)
  return c.json({ rule: result.rule })
})

// --- Human-in-the-Loop Review Queue ---

assistantRoutes.get('/review-queue', async (c) => {
  return c.json({ items: await listPendingReviewItems() })
})

assistantRoutes.post('/review-queue/:id/approve', uuidParam('id'), async (c) => {
  const id = c.req.param('id')
  const result = await resolveReviewItem(id, 'approve')
  if (!result.ok) return c.json({ error: result.error }, result.status)
  return c.json({ approved: id, ruleId: result.ruleId, alsoFiled: result.alsoFiled })
})

assistantRoutes.post('/review-queue/:id/reject', uuidParam('id'), async (c) => {
  const id = c.req.param('id')
  const result = await resolveReviewItem(id, 'reject')
  if (!result.ok) return c.json({ error: result.error }, result.status)
  return c.json({ rejected: id })
})

// --- Confidence Gate Settings ---

assistantRoutes.get('/gate', async (c) => {
  return c.json({ settings: await getGateSettings(LOCAL_TENANT_ID) })
})

assistantRoutes.put('/gate', async (c) => {
  const body = await c.req.json<Partial<GateSettingsInput>>().catch(() => ({}))
  const result = await saveGateSettings(LOCAL_TENANT_ID, body)
  if (!result.ok) return c.json({ error: result.error }, 400)
  return c.json({ settings: result.settings })
})
