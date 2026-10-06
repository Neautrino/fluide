import type { GateSettings } from '../../lib/api'
import { toNumber } from '@repo/ui/format'

export type Draft = { highConfidence: string; lowConfidence: string; amountRangeTolerance: string }
export type Key = keyof Draft

export const DEFAULTS: Draft = { highConfidence: '0.75', lowConfidence: '0.50', amountRangeTolerance: '0.5' }

export const FIELDS: { key: Key; label: string; step: string; min: string; max?: string; inputMode: 'decimal'; help: string }[] = [
  {
    key: 'highConfidence',
    label: 'High threshold',
    step: '0.01',
    min: '0',
    max: '1',
    inputMode: 'decimal',
    help: 'At or above: applied automatically unless the amount looks unusual for the vendor. Default 0.75.',
  },
  {
    key: 'lowConfidence',
    label: 'Low threshold',
    step: '0.01',
    min: '0',
    max: '1',
    inputMode: 'decimal',
    help: 'Below: no suggestion is made. Default 0.50.',
  },
  {
    key: 'amountRangeTolerance',
    label: 'Amount tolerance',
    step: '0.05',
    min: '0',
    max: '999',
    inputMode: 'decimal',
    help: 'Checked only once the vendor has an earlier transaction in that category. A charge may sit outside the vendor’s past amounts by up to the largest of: the width of that range, this fraction of its largest amount, or 1. Beyond that it waits in Review. Default 0.5.',
  },
]

export function toDraft(s: GateSettings): Draft {
  return {
    highConfidence: String(toNumber(s.highConfidence)),
    lowConfidence: String(toNumber(s.lowConfidence)),
    amountRangeTolerance: String(toNumber(s.amountRangeTolerance)),
  }
}

export function validate(d: Draft): Partial<Record<Key, string>> {
  const errors: Partial<Record<Key, string>> = {}
  const n = (k: Key) => (d[k].trim() === '' ? Number.NaN : Number(d[k]))
  const high = n('highConfidence')
  const low = n('lowConfidence')
  const tol = n('amountRangeTolerance')
  if (!Number.isFinite(high) || high < 0 || high > 1) errors.highConfidence = 'Enter a number from 0 to 1.'
  if (!Number.isFinite(low) || low < 0 || low > 1) errors.lowConfidence = 'Enter a number from 0 to 1.'
  else if (Number.isFinite(high) && low >= high) errors.lowConfidence = 'Must be lower than the high threshold.'
  if (!Number.isFinite(tol) || tol < 0 || tol > 999) errors.amountRangeTolerance = 'Enter a number from 0 to 999.'
  return errors
}
