import { createRootRoute, createRoute, createRouter, type Router, type RouterHistory } from '@tanstack/react-router'
import { Root } from './routes/Root'
import { Landing } from './routes/Landing'
import { Manifesto } from './routes/Manifesto'
import { Docs } from './routes/Docs'

const rootRoute = createRootRoute({ component: Root })

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: Landing }),
  createRoute({ getParentRoute: () => rootRoute, path: '/manifesto', component: Manifesto }),
  createRoute({ getParentRoute: () => rootRoute, path: '/docs', component: Docs }),
])

export type AppRouter = Router<typeof routeTree>

/** One router per render: the browser's history on the client, a memory history per URL when prerendering. */
export function createAppRouter(history?: RouterHistory): AppRouter {
  return createRouter({ routeTree, history })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: AppRouter
  }
}
