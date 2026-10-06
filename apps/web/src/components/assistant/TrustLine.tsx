import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { AssistantTrustLine } from '@repo/ui/assistant'
import { chipText, summarizeConnections } from '@repo/ui/connection-health'
import { connectionsOptions, useReviewCount } from '../../lib/queries'

/** Shown only while something limits what answers can see; silent when all is well or the check fails. */
export function TrustLine() {
  const navigate = useNavigate()
  const reviewCount = useReviewCount()
  const connections = useQuery(connectionsOptions())
  const data = connections.isError ? undefined : connections.data

  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read the clock whenever connections are (re)loaded
  const now = useMemo(() => Date.now(), [data])
  const { live, attention, syncStamp } = summarizeConnections(data ?? [], now)
  const flags = attention.map(({ connection: c, health }) => ({ id: c.id, text: chipText(c, health), severity: health.severity }))
  const waiting = reviewCount ?? 0
  if (flags.length === 0 && waiting === 0) return null

  return (
    <AssistantTrustLine
      flags={flags}
      others={live.length - flags.length}
      syncStamp={syncStamp}
      waiting={waiting}
      onSettings={() => void navigate({ to: '/settings' })}
      onReview={() => void navigate({ to: '/review' })}
    />
  )
}
