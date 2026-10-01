import { useMemo } from 'react'
import { getJson, getVersionInfo, type ConnectionSummary } from './api'
import { useApp, type View } from './app-context'
import { shortName, summarizeConnections } from './connection-health'
import { useResource } from './useResource'

export type NotificationTone = 'accent' | 'warning' | 'broken'

export type Notification = {
  id: string
  tone: NotificationTone
  text: string
  detail: string
  view: View
  section?: 'general' | 'connections'
}

export function useNotifications(): Notification[] {
  const { version, reviewCount } = useApp()
  const versionInfo = useResource(getVersionInfo, version)
  const connections = useResource(
    (signal) => getJson<{ connections: ConnectionSummary[] }>('/api/providers/connections', signal).then((r) => r.connections),
    version,
  )
  const info = versionInfo.data
  const list = connections.data

  return useMemo(() => {
    const items: Notification[] = []
    if (info?.updateAvailable && info.latest) {
      items.push({
        id: 'update',
        tone: 'accent',
        text: `Update available: v${info.latest.version}`,
        detail: `You're on v${info.current}`,
        view: 'settings',
        section: 'general',
      })
    }
    for (const { connection, health } of summarizeConnections(list ?? [], Date.now()).attention) {
      items.push({
        id: `connection:${connection.id}`,
        tone: health.severity === 'broken' ? 'broken' : 'warning',
        text: shortName(connection.institutionName ?? 'Bank'),
        detail: health.label ?? '',
        view: 'settings',
        section: 'connections',
      })
    }
    if (reviewCount && reviewCount > 0) {
      items.push({ id: 'review', tone: 'warning', text: `${reviewCount} waiting in Review`, detail: 'Open Review to clear them', view: 'review' })
    }
    return items
  }, [info, list, reviewCount])
}
