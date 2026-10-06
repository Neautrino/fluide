import { Amt } from './shared'
import type { Tile } from './helpers'

const TONES = ['bg-tile-1', 'bg-tile-2', 'bg-tile-3', 'bg-tile-4']

/** Colour follows the account, so tiles keep their colour when another one drops out. */
const toneFor = (key: string) => TONES[[...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TONES.length]

export function AtStake({ tiles }: { tiles: Tile[] }) {
  if (tiles.length === 0) return null
  return (
    <section aria-label="At stake, by account">
      <h3 className="mb-2.5 font-display text-[17px] leading-tight font-bold text-ink">At stake, by account</h3>
      <div className="grid grid-cols-3 gap-2.5">
        {tiles.map((t) => (
          <div key={t.key} className={`flex min-h-28 min-w-0 flex-col justify-between rounded-md border border-line-strong p-3 text-tile-ink ${toneFor(t.key)}`}>
            <span className="text-[10.5px] leading-tight font-bold tracking-[.05em] break-words uppercase">{t.name}</span>
            <div>
              <Amt value={t.total} currency={t.currency} sign="never" className="block text-[18px] font-extrabold" />
              <span className="text-[11px] opacity-75">{t.waiting} waiting</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
