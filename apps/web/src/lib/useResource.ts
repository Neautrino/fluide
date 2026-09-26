import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from './api'

export type Resource<T> = {
  data: T | undefined
  error: string | null
  loading: boolean
  reload: () => void
}

/** `key` should be a primitive (string/number/null); a change refetches. */
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>, key: unknown = null): Resource<T> {
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })
  const [nonce, setNonce] = useState(0)
  // `for` records which (key, nonce) the settled result belongs to; while it
  // differs from the current pair a request is in flight. Previous data stays
  // visible meanwhile to avoid flicker.
  const [state, setState] = useState<{ data: T | undefined; error: string | null; for: [unknown, number] | null }>({
    data: undefined,
    error: null,
    for: null,
  })

  useEffect(() => {
    const controller = new AbortController()
    loadRef.current(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ data, error: null, for: [key, nonce] })
      },
      (e: unknown) => {
        if (!controller.signal.aborted) setState({ data: undefined, error: errorMessage(e), for: [key, nonce] })
      },
    )
    return () => controller.abort()
  }, [key, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  const loading = !state.for || state.for[0] !== key || state.for[1] !== nonce
  return { data: state.data, error: loading && state.data === undefined ? null : state.error, loading, reload }
}
