import type { UseQueryResult } from '@tanstack/react-query'
import { ErrorState, Loading } from '@repo/ui/primitives'
import { queryError } from '../../lib/queries'

/** Stands in for a card body until `ready`: loading, or the error that stopped the source. */
export function Pending({ resource, what, ready }: { resource: UseQueryResult<unknown>; what: string; ready: boolean }) {
  if (ready) return null
  return (
    <div className="mt-3">
      {resource.isError ? (
        <ErrorState title={`Couldn't load ${what}`} message={queryError(resource)} onRetry={() => void resource.refetch()} />
      ) : (
        <Loading label={`Loading ${what}`} rows={3} />
      )}
    </div>
  )
}
