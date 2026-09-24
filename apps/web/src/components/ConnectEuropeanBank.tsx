import { useState } from 'react'
import { errorMessage, getJson } from '../lib/api'
import { startEnableBankingConnect, type EnableBankingBank } from '../lib/enable-banking'
import { useResource } from '../lib/useResource'
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

export function ConnectEuropeanBank({ variant = 'primary' }: { variant?: 'primary' | 'secondary' }) {
  const [open, setOpen] = useState(false)
  const [country, setCountry] = useState('')
  const [bankName, setBankName] = useState('')
  const [redirecting, setRedirecting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const banks = useResource(
    (signal) =>
      country
        ? getJson<{ aspsps: EnableBankingBank[] }>(`/enable-banking/aspsps?country=${country}`, signal).then(
            (r) => r.aspsps,
          )
        : Promise.resolve([] as EnableBankingBank[]),
    country,
  )

  const httpsMissing = window.location.protocol !== 'https:'

  if (!open) {
    return (
      <Button variant={variant} onClick={() => setOpen(true)}>
        Connect a European bank
      </Button>
    )
  }

  const bank = banks.data?.find((b) => b.name === bankName)

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

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      {httpsMissing && (
        <Notice tone="error">
          Banks only redirect back to an https address. Set WEB_TLS_CERT_PATH and WEB_TLS_KEY_PATH in apps/web/.env
          and open Fluide over https.
        </Notice>
      )}
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
        <Field id="eb-bank" label="Bank" error={banks.error}>
          <Select
            id="eb-bank"
            aria-describedby="eb-bank-error"
            value={bankName}
            disabled={banks.loading}
            onChange={(e) => setBankName(e.target.value)}
          >
            <option value="">{banks.loading ? 'Loading banks…' : 'Choose a bank'}</option>
            {banks.data?.map((b) => (
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
        <Button variant="secondary" onClick={() => setOpen(false)} disabled={redirecting}>
          Cancel
        </Button>
      </div>
      {startError && <Notice tone="error">Couldn't start the bank connection: {startError}</Notice>}
      <p className="text-[13px] text-ink-3">
        Read-only: your bank shows exactly what Fluide may read. Fluide can never move money.
      </p>
    </div>
  )
}
