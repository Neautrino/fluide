import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { StrictMode, Suspense, type ReactNode } from 'react'
import { renderToString } from 'react-dom/server'
import { createAppRouter } from './router'

export { PAGES, ROUTES } from './pages'

/* In the browser, <RouterProvider> renders the matches inside a <Suspense> that it leaves out on the
   server (where TanStack expects its full SSR hydration protocol, which a static site doesn't need).
   Adding the same boundary here gives the prerendered HTML the client's structure, so it hydrates. */
function ClientSuspense({ children }: { children: ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>
}

/** Renders one route to the HTML that goes inside #root (called by prerender.ts at build time). */
export async function render(url: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [url] }))
  router.update({ ...router.options, InnerWrap: ClientSuspense })
  await router.load()
  return renderToString(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}
