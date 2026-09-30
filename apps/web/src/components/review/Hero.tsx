import { pct, type AtStake } from './helpers'
import { StakeAmounts } from './shared'

export function Hero({ count, stake, high }: { count: number; stake: AtStake[]; high: number | null }) {
  return (
    <section aria-label="Review queue summary" className="rounded-lg bg-surface-inverse px-6 pt-[22px] pb-5 text-ink-inverse">
      <p className="text-[11px] font-semibold tracking-[.07em] uppercase opacity-70">Review queue</p>
      <h2 className="figures mt-1.5 font-display text-[clamp(32px,2.6vw,40px)] leading-[1.05] font-extrabold tracking-[-.03em]">
        {count} waiting
        {stake.length > 0 && (
          <>
            {' '}
            <span className="opacity-50">·</span> <StakeAmounts stake={stake} /> at stake
          </>
        )}
      </h2>
      <p className="mt-3 max-w-2xl text-[13px] leading-normal opacity-80">
        Suggestions the model wasn't sure enough to apply on its own
        {high !== null && ` (auto-apply needs ${pct(high)} and a vendor history)`}. They stay uncategorized and still
        counted until you decide.
      </p>
    </section>
  )
}
