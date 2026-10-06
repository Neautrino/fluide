import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import { createAppRouter } from './router'

const router = createAppRouter()
// resolve the route before the first render so it matches the prerendered HTML
await router.load()

const app = (
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
const root = document.getElementById('root')!
// built pages arrive prerendered and are hydrated; the dev server serves an empty #root
if (root.hasChildNodes()) hydrateRoot(root, app)
else createRoot(root).render(app)
