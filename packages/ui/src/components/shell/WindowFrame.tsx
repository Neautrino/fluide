import type { ReactNode } from 'react'

/** The desktop window: canvas padding, the rounded card, the sidebar column and the main column. */
export function AppWindow({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-svh bg-canvas md:p-6">
      <div className="mx-auto flex min-h-svh flex-col overflow-clip bg-surface md:min-h-[852px] md:max-w-[1392px] md:grid md:grid-cols-[232px_minmax(0,1fr)] md:rounded-xl md:border md:border-line md:shadow-2">
        {sidebar}
        <main className="flex min-w-0 flex-1 flex-col gap-5 px-[28px] pb-[30px]">{children}</main>
      </div>
    </div>
  )
}
