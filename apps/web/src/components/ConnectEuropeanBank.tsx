import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { errorMessage } from '../lib/api'
import { HTTPS_REASON, isHttps } from '../lib/connection-health'
import { ENABLE_BANKING_AVAILABLE, startEnableBankingConnect } from '../lib/enable-banking'
import { aspspsOptions, queryError } from '../lib/queries'
import { Button } from './ui/Button'
import { Field, Select } from './ui/Field'
import { Notice } from './ui/States'

/** Pick a country and bank, then leave for the bank's own login (Enable
 * Banking, PSD2, read-only). The bank redirects back to
 * ENABLE_BANKING_CALLBACK_PATH, handled by EnableBankingCallback. */

const COUNTRIES: Record<string, string> = {
  AT: 'Austria',
  BE: 'Belgium',
  BG: 'Bulgaria',
  HR: 'Croatia',
  CY: 'Cyprus',
  CZ: 'Czechia',
  DK: 'Denmark',
  EE: 'Estonia',
  FI: 'Finland',
  FR: 'France',
  DE: 'Germany',
  GR: 'Greece',
  HU: 'Hungary',
  IS: 'Iceland',
  IE: 'Ireland',
  IT: 'Italy',
  LV: 'Latvia',
  LI: 'Liechtenstein',
  LT: 'Lithuania',
  LU: 'Luxembourg',
  MT: 'Malta',
  NL: 'Netherlands',
  NO: 'Norway',
  PL: 'Poland',
  PT: 'Portugal',
  RO: 'Romania',
  SK: 'Slovakia',
  SI: 'Slovenia',
  ES: 'Spain',
  SE: 'Sweden',
}

type Props = {
  variant?: 'primary' | 'secondary'
  /** Replaces the default button. The trigger stays mounted while the picker is open. */
  renderTrigger?: (trigger: { onClick: () => void; triggerRef: RefObject<HTMLButtonElement | null> }) => ReactNode
  /** Where the picker renders, instead of straight after the trigger. */
  panelIn?: HTMLElement | null
}

export function ConnectEuropeanBank({ variant = 'primary', renderTrigger, panelIn }: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)
  const [open, setOpen] = useState(false)
  const [country, setCountry] = useState('')
  const [bankName, setBankName] = useState('')
  const [redirecting, setRedirecting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const banks = useQuery({ ...aspspsOptions(country), placeholderData: keepPreviousData })
  const bankList = banks.isError ? undefined : banks.data

  const httpsMissing = !isHttps()

  useEffect(() => {
    if (open) document.getElementById('eb-country')?.focus()
    else if (returnFocus.current && !renderTrigger) {
      returnFocus.current = false
      document.getElementById('eb-open')?.focus()
    }
  }, [open, renderTrigger])

  if (!open && !renderTrigger) {
    const reason = !ENABLE_BANKING_AVAILABLE ? 'Not available yet' : httpsMissing ? HTTPS_REASON : null
    return (
      <div className="flex flex-col items-start gap-1.5">
        <Button
          id="eb-open"
          variant={variant}
          disabled={reason !== null}
          aria-describedby={reason ? 'eb-reason' : undefined}
          onClick={() => setOpen(true)}
        >
          Connect a European bank
        </Button>
        {reason && (
          <p id="eb-reason" className="max-w-sm text-[12px] text-ink-3">
            {reason}
          </p>
        )}
      </div>
    )
  }

  const bank = bankList?.find((b) => b.name === bankName)

  const connect = async () => {
    if (!bank) return
    setRedirecting(true)
    setStartError(null)
    try {
      await startEnableBankingConnect(bank)
    } catch (e) {
      setStartError(errorMessage(e))
      setRedirecting(false)
    }
  }

  const panel = (
    <div className="flex w-full max-w-sm flex-col gap-3">
      {httpsMissing && <Notice tone="error">{HTTPS_REASON}</Notice>}
      <Field id="eb-country" label="Country">
        <Select
          id="eb-country"
          value={country}
          onChange={(e) => {
            setCountry(e.target.value)
            setBankName('')
          }}
        >
          <option value="">Choose a country</option>
          {Object.entries(COUNTRIES).map(([code, name]) => (
            <option key={code} value={code}>
              {name}
            </option>
          ))}
        </Select>
      </Field>
      {country && (
        <Field id="eb-bank" label="Bank" error={queryError(banks)}>
          <Select
            id="eb-bank"
            aria-describedby="eb-bank-error"
            value={bankName}
            disabled={banks.isFetching}
            onChange={(e) => setBankName(e.target.value)}
          >
            <option value="">{banks.isFetching ? 'Loading banks…' : 'Choose a bank'}</option>
            {bankList?.map((b) => (
              <option key={b.name} value={b.name}>
                {b.beta ? `${b.name} (beta)` : b.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <div className="flex gap-2">
        <Button variant="primary" onClick={connect} busy={redirecting} disabled={!bank || httpsMissing}>
          {redirecting ? 'Opening your bank…' : 'Continue to bank'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            returnFocus.current = true
            setOpen(false)
            if (renderTrigger) triggerRef.current?.focus()
          }}
          disabled={redirecting}
        >
          Cancel
        </Button>
      </div>
      {startError && <Notice tone="error">Couldn't start the bank connection: {startError}</Notice>}
      <p className="text-[13px] text-ink-3">
        Read-only: your bank shows exactly what Fluide may read. Fluide can never move money.
      </p>
    </div>
  )

  if (!renderTrigger) return panel
  return (
    <>
      {renderTrigger({ onClick: () => setOpen(true), triggerRef })}
      {open && (panelIn ? createPortal(panel, panelIn) : panel)}
    </>
  )
}
