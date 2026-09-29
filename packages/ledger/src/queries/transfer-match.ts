import type { AccountKind, TransferKind, TransferMarkMethod } from '../schema/index.js'

/** Which mark methods prove a kind is money staying in the user's hands, so
 * the movement leaves cash flow. A provider-tagged transfer is not proof
 * (Plaid's TRANSFER also covers Zelle/Venmo/ACH to other people and ATM
 * cash); a provider-tagged card payment is a payment into the user's card. */
export const EXCLUDING_METHODS = {
  transfer: ['pair_match', 'user'],
  card_payment: ['pair_match', 'provider_tag', 'user'],
  investment: ['pair_match', 'user'],
} as const satisfies Partial<Record<TransferKind, readonly TransferMarkMethod[]>>

export type ExcludedKind = keyof typeof EXCLUDING_METHODS

/** Is a movement with this mark left out of income, spending and debt payments. */
export function isExcludedMark(kind: TransferKind, method: TransferMarkMethod): boolean {
  const methods: readonly TransferMarkMethod[] | undefined = EXCLUDING_METHODS[kind as ExcludedKind]
  return methods?.includes(method) ?? false
}

/** A possible transfer: counted, but listed for the user to decide. */
export const SUGGESTED_MARK = { kind: 'transfer', method: 'provider_tag' } as const satisfies {
  kind: TransferKind
  method: TransferMarkMethod
}

export function isSuggestedMark(kind: TransferKind, method: TransferMarkMethod): boolean {
  return kind === SUGGESTED_MARK.kind && method === SUGGESTED_MARK.method
}

/** One live bank leg as the pair matcher sees it. `amount` is ledger-signed:
 * negative = money left the account. */
export type TransferLeg = {
  transactionId: string
  accountId: string
  amount: number
  currency: string
  date: Date
}

export const PAIR_WINDOW_DAYS = 4
const PAIR_WINDOW_MS = PAIR_WINDOW_DAYS * 24 * 60 * 60 * 1000

/** Could `out` and `inflow` be the two sides of one movement: exact
 * opposite amount, same currency, different accounts, within the window. */
export function isTransferPairCandidate(out: TransferLeg, inflow: TransferLeg) {
  return (
    out.amount < 0 &&
    inflow.amount === -out.amount &&
    inflow.currency === out.currency &&
    inflow.accountId !== out.accountId &&
    Math.abs(out.date.getTime() - inflow.date.getTime()) <= PAIR_WINDOW_MS
  )
}

/** Pairs an outflow with an inflow of the exact opposite amount, same
 * currency, on another account, within PAIR_WINDOW_DAYS -- only when each
 * leg is the other's sole candidate. Ambiguous legs stay unpaired rather
 * than guessed. */
export function matchTransferPairs(legs: TransferLeg[]): Array<{ outTransactionId: string; inTransactionId: string }> {
  const inflowsByAmount = new Map<string, TransferLeg[]>()
  for (const leg of legs) {
    if (leg.amount <= 0) continue
    const k = `${leg.currency}:${leg.amount}`
    const group = inflowsByAmount.get(k)
    if (group) group.push(leg)
    else inflowsByAmount.set(k, [leg])
  }

  const candidatesOfOut = new Map<TransferLeg, TransferLeg[]>()
  const candidateCountOfIn = new Map<TransferLeg, number>()
  for (const out of legs) {
    if (out.amount >= 0) continue
    const matches = (inflowsByAmount.get(`${out.currency}:${-out.amount}`) ?? []).filter((inflow) =>
      isTransferPairCandidate(out, inflow),
    )
    candidatesOfOut.set(out, matches)
    for (const inflow of matches) candidateCountOfIn.set(inflow, (candidateCountOfIn.get(inflow) ?? 0) + 1)
  }

  const pairs: Array<{ outTransactionId: string; inTransactionId: string }> = []
  for (const [out, matches] of candidatesOfOut) {
    const inflow = matches[0]
    if (matches.length !== 1 || !inflow || candidateCountOfIn.get(inflow) !== 1) continue
    pairs.push({ outTransactionId: out.transactionId, inTransactionId: inflow.transactionId })
  }
  return pairs
}

type LegKind = AccountKind | null

/** A day-to-day account: cash, 'other', or not yet classified (NULL). */
function isEverydayAccount(kind: LegKind) {
  return kind === null || kind === 'cash' || kind === 'other'
}

/** What a matched pair is, from the two accounts' kinds. */
export function pairTransferKind(outKind: LegKind, inKind: LegKind): TransferKind {
  if (inKind === 'loan') return 'loan_payment'
  if (outKind === 'investment' || inKind === 'investment') return 'investment'
  if ((isEverydayAccount(outKind) && inKind === 'credit') || (outKind === 'credit' && isEverydayAccount(inKind))) {
    return 'card_payment'
  }
  return 'transfer'
}

/** What an unpaired leg is from its provider tags (Plaid PFC primary),
 * or undefined when the tags say nothing about a transfer. A LOAN_PAYMENTS
 * inflow on an everyday account (a returned payment) stays unmarked so it
 * counts as income: loan_payment is only ever money out. */
export function taggedTransferKind(
  accountKind: LegKind,
  amount: number,
  tags: readonly string[] | null,
): TransferKind | undefined {
  if (!tags) return undefined
  if (tags.includes('plaid:TRANSFER_IN') || tags.includes('plaid:TRANSFER_OUT')) return 'transfer'
  if (!tags.includes('plaid:LOAN_PAYMENTS')) return undefined
  if (accountKind === 'credit') return 'card_payment'
  if (isEverydayAccount(accountKind) && amount < 0) return 'loan_payment'
  return undefined
}
