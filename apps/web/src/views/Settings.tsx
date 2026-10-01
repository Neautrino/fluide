import { useEffect, useMemo, useState } from 'react'
import { Connections } from '../components/Connections'
import { AddConnection } from '../components/settings/AddConnection'
import { GateCard } from '../components/settings/GateCard'
import { GeneralCard } from '../components/settings/GeneralCard'
import { ProviderKeys } from '../components/settings/ProviderKeys'
import { SettingsNav } from '../components/settings/SettingsNav'
import { AiCard } from '../components/settings/AiCard'
import { TrustLine } from '../components/settings/TrustLine'
import { getJson, type ConnectionSummary } from '../lib/api'
import { useApp } from '../lib/app-context'
import { summarizeConnections } from '../lib/connection-health'
import { useResource } from '../lib/useResource'

export function Settings() {
  const { version, invalidate } = useApp()
  const connections = useResource(
    (signal) => getJson<{ connections: ConnectionSummary[] }>('/api/providers/connections', signal).then((r) => r.connections),
    version,
  )
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 60_000)
    return () => window.clearInterval(id)
  }, [])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the clock is re-read when connections reload and every minute
  const now = useMemo(() => Date.now(), [connections.data, tick])
  const { live, broken } = summarizeConnections(connections.data ?? [], now)

  return (
    <div className="grid grid-cols-1 items-start gap-4 min-[1280px]:grid-cols-[164px_minmax(0,1fr)] min-[1280px]:gap-[18px] min-[1361px]:grid-cols-[184px_minmax(0,1fr)] min-[1361px]:gap-[26px]">
      <SettingsNav brokenCount={broken.length} />
      <div className="flex min-w-0 flex-col gap-[18px]">
        <GeneralCard />
        <TrustLine connections={connections.data ?? []} now={now} />
        <Connections connections={connections} now={now} />
        <AddConnection onConnected={invalidate} />
        <ProviderKeys connections={live} />
        <AiCard />
        <GateCard />
      </div>
    </div>
  )
}
