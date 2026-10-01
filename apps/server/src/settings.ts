/* SOURCE OF TRUTH: writes to gate_settings and tenant_settings; DISPLAY_CURRENCIES allowlist.
 * Invariant: validation rejects everything the settings CHECKs reject (400, not a constraint 500).
 * See: ADR 002 — why thresholds live in the DB
 */
import {
  db,
  gateSettings,
  getGateSettings,
  saveTenantSettings,
  type GateSettings,
  type TenantSettings,
} from '@repo/ledger'

export type GateSettingsInput = Omit<GateSettings, 'updatedAt'>

function validate(input: Partial<GateSettingsInput>): string | GateSettingsInput {
  const { highConfidence, lowConfidence, amountRangeTolerance } = input
  const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
  if (!isNum(highConfidence) || !isNum(lowConfidence) || !isNum(amountRangeTolerance)) {
    return 'highConfidence, lowConfidence and amountRangeTolerance are all required numbers'
  }
  if (!(lowConfidence >= 0 && lowConfidence < highConfidence && highConfidence <= 1)) {
    return 'confidence thresholds must satisfy 0 <= lowConfidence < highConfidence <= 1'
  }
  if (amountRangeTolerance < 0 || amountRangeTolerance > 999) {
    return 'amountRangeTolerance must be between 0 and 999'
  }
  return { highConfidence, lowConfidence, amountRangeTolerance }
}

export async function saveGateSettings(
  tenantId: string,
  input: Partial<GateSettingsInput>,
): Promise<{ ok: true; settings: GateSettings } | { ok: false; error: string }> {
  const valid = validate(input)
  if (typeof valid === 'string') return { ok: false, error: valid }

  const values = {
    highConfidence: valid.highConfidence.toFixed(3),
    lowConfidence: valid.lowConfidence.toFixed(3),
    amountRangeTolerance: valid.amountRangeTolerance.toFixed(3),
    updatedAt: new Date(),
  }
  await db
    .insert(gateSettings)
    .values({ tenantId, ...values })
    .onConflictDoUpdate({ target: gateSettings.tenantId, set: values })
  return { ok: true, settings: await getGateSettings(tenantId) }
}

export const DISPLAY_CURRENCIES = ['USD', 'EUR', 'INR'] as const
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number]

export const isDisplayCurrency = (value: unknown): value is DisplayCurrency =>
  typeof value === 'string' && (DISPLAY_CURRENCIES as readonly string[]).includes(value)

export async function saveGeneralSettings(
  tenantId: string,
  input: { displayCurrency?: unknown },
): Promise<{ ok: true; settings: TenantSettings } | { ok: false; error: string }> {
  if (!isDisplayCurrency(input.displayCurrency)) {
    return { ok: false, error: `displayCurrency must be one of ${DISPLAY_CURRENCIES.join(', ')}` }
  }
  return { ok: true, settings: await saveTenantSettings(tenantId, { displayCurrency: input.displayCurrency }) }
}
