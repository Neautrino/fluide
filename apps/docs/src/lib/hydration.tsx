import { useSyncExternalStore, type HTMLAttributes, type ReactNode } from 'react'

const subscribeNever = () => () => {}

/** True after hydration, false on the server and during the hydration render. */
export function useHydrated() {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  )
}

/**
 * Renders `<div {...props}>` and mounts `children` in it only after hydration, so locale- and clock-dependent
 * app UI never runs during prerender. Size the box yourself (width/height/aspect-ratio) so nothing moves when
 * the children arrive.
 */
export function ClientOnly({ children, fallback = null, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode; fallback?: ReactNode }) {
  return <div {...props}>{useHydrated() ? children : fallback}</div>
}
