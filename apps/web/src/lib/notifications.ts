import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { shortName, summarizeConnections } from '@repo/ui/connection-health'
import { connectionsOptions, useReviewCount, versionInfoOptions } from './queries'

export type NotificationTone = 'accent' | 'warning' | 'broken'

export type Notification = {
  id: string
  tone: NotificationTone
  text: string
  detail: string
  to: '/settings' | '/review'
  section?: 'general' | 'connections'
}

export function useNotifications(): Notification[] {
  const reviewCount = useReviewCount()
  const versionInfo = useQuery(versionInfoOptions())
  const connections = useQuery(connectionsOptions())
  const info = versionInfo.isError ? undefined : versionInfo.data
  const list = connections.isError ? undefined : connections.data

  return useMemo(() => {
    const items: Notification[] = []
    if (info?.updateAvailable && info.latest) {
      items.push({
        id: 'update',
        tone: 'accent',
        text: `Update available: v${info.latest.version}`,
        detail: `You're on v${info.current}`,
        to: '/settings',
        section: 'general',
      })
    }
    for (const { connection, health } of summarizeConnections(list ?? [], Date.now()).attention) {
      items.push({
        id: `connection:${connection.id}`,
        tone: health.severity === 'broken' ? 'broken' : 'warning',
        text: shortName(connection.institutionName ?? 'Bank'),
        detail: health.label ?? '',
        to: '/settings',
        section: 'connections',
      })
    }
    if (reviewCount && reviewCount > 0) {
      items.push({ id: 'review', tone: 'warning', text: `${reviewCount} waiting in Review`, detail: 'Open Review to clear them', to: '/review' })
    }
    return items
  }, [info, list, reviewCount])
}
