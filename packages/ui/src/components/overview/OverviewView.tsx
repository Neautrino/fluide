import type { ReactNode } from 'react'

/** The Overview page: two strips, then an 8/4 split of cards. Each slot takes the card the host built. */
export function OverviewView({
  chips,
  needsYou,
  cashOnHand,
  ownAndOwe,
  latest,
  spendByMonth,
  whereItWent,
}: {
  chips?: ReactNode
  needsYou?: ReactNode
  cashOnHand?: ReactNode
  ownAndOwe?: ReactNode
  latest?: ReactNode
  spendByMonth?: ReactNode
  whereItWent?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-5">
      {chips}
      {needsYou}
      <div className="grid grid-cols-1 items-start gap-4 min-[1280px]:grid-cols-[minmax(0,8fr)_minmax(0,4fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          {cashOnHand}
          {ownAndOwe}
          {latest}
        </div>
        <div className="mx-auto flex w-full min-w-0 max-w-[480px] flex-col gap-4 min-[1280px]:max-w-none">
          {spendByMonth}
          {whereItWent}
        </div>
      </div>
    </div>
  )
}
