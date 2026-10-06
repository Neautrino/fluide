import { useSyncExternalStore } from 'react'

/** Stands in for an amount in aria-labels, titles and other text that CSS can't blur. */
export const AMOUNT_HIDDEN = 'amount hidden'

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

const isHidden = () => document.documentElement.classList.contains('amounts-hidden')

/** Follows the header's eye button (`html.amounts-hidden`); visible amounts are blurred by the `amt` class itself. */
export function useAmountsHidden(): boolean {
  return useSyncExternalStore(subscribe, isHidden, () => false)
}
