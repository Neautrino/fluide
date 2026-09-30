import { plural, type MatchStats } from './model'

const count = new Intl.NumberFormat()

export function Hero({ stats }: { stats: MatchStats }) {
  return (
    <section aria-label="Settled by your rules" className="rounded-lg bg-surface-inverse px-6 pt-[22px] pb-5 text-ink-inverse max-[1360px]:px-5 max-[1360px]:py-[18px]">
      <p className="text-[12.5px] font-semibold opacity-80">Settled by your rules · all time</p>
      <p className="figures mt-2.5 font-display text-[50px] leading-none font-extrabold tracking-[-0.03em] max-[1360px]:text-[44px]">{count.format(stats.matched)}</p>
      <p className="mt-2 text-[12.5px] leading-[1.4] opacity-[.86]">
        Matched by {stats.active} active {plural(stats.active, 'rule')}: {count.format(stats.userMatched)} by rules you wrote, {count.format(stats.learnedMatched)} by
        learned rules.
      </p>
    </section>
  )
}
