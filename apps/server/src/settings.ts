/** SOURCE OF TRUTH: writes to gate_settings (the confidence gate's thresholds).
 * WHAT: validates a Settings-screen save and upserts the tenant's row.
 * WHY: the DB CHECKs in schema.ts are the real floor (a bad row can't
 * exist); this validation exists only to return a readable 400 instead of
 * a constraint-violation 500, so both must stay in agreement.
 * WHERE: owns the write only. Reads (with defaults) live in @repo/ledger's
 * getGateSettings; the gate that consumes them is categorization/gate.ts.
 */
import { db, gateSettings, getGateSettings, type GateSettings } from '@repo/ledger'

export type GateSettingsInput = Omit<GateSettings, 'updatedAt'>

function validate(input: Partial<GateSettingsInput>): string | GateSettingsInput {
  const { highConfidence, lowConfidence, minVendorOccurrences, amountRangeTolerance } = input
  const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
  if (!isNum(highConfidence) || !isNum(lowConfidence) || !isNum(minVendorOccurrences) || !isNum(amountRangeTolerance)) {
    return 'highConfidence, lowConfidence, minVendorOccurrences and amountRangeTolerance are all required numbers'
  }
  if (!(lowConfidence >= 0 && lowConfidence < highConfidence && highConfidence <= 1)) {
    return 'confidence thresholds must satisfy 0 <= lowConfidence < highConfidence <= 1'
  }
  if (!Number.isInteger(minVendorOccurrences) || minVendorOccurrences < 1) {
    return 'minVendorOccurrences must be a whole number of at least 1'
  }
  if (amountRangeTolerance < 0 || amountRangeTolerance > 999) {
    return 'amountRangeTolerance must be between 0 and 999'
  }
  return { highConfidence, lowConfidence, minVendorOccurrences, amountRangeTolerance }
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
    minVendorOccurrences: valid.minVendorOccurrences,
    amountRangeTolerance: valid.amountRangeTolerance.toFixed(3),
    updatedAt: new Date(),
  }
  await db
    .insert(gateSettings)
    .values({ tenantId, ...values })
    .onConflictDoUpdate({ target: gateSettings.tenantId, set: values })
  return { ok: true, settings: await getGateSettings(tenantId) }
}
