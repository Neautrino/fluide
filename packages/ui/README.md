# @repo/ui

The DS01 design system and every Fluide component that is driven by props alone. `apps/web` renders the
product from here; `apps/docs` renders the same components from sample data on the public site.

## What lives here

- `src/styles.css` — the whole DS01 system: light and dark tokens, the `@theme inline` mapping, the base
  layer, the `figures` / `eyebrow` / `amt` utilities, the keyframes, the reduced-motion block, and the
  fontsource imports (Archivo, Plus Jakarta Sans, Geist Mono).
- `src/types.ts` — the wire shapes the server sends. No fetching: the client that produces them stays in
  the app (`apps/web/src/lib/api.ts` re-exports these for app code).
- `src/lib/*` — pure helpers: money and date formatting, the category catalogue, connection health.
- `src/components/*` — primitives, the window frame, and the product cards, grouped by the view they serve.

## What never lives here

Data fetching, TanStack Query, TanStack Router, app context. Navigation is a prop (`onOpenAccounts`,
`renderLink`, …) and a loading or error slot is a `ReactNode` the host passes in (`pending`). Anything that
has to call `useQuery` stays in the app as a thin container around the component here.

## Consuming it

```css
/* the app's entry stylesheet */
@import "tailwindcss";
@import "@repo/ui/styles.css";
```

That is the only stylesheet import a consumer needs. `styles.css` carries `@source "./";`, which is what
makes Tailwind scan `packages/ui/src` and emit the classes these components use — without it a consumer's
build drops every class that only appears in this package.

Then import from the subpath that owns the piece:

```tsx
import { Button, Money } from '@repo/ui/primitives'
import { AppWindow } from '@repo/ui/shell'
import { QueueCard } from '@repo/ui/review'
import type { ReviewItem } from '@repo/ui/types'
```

Subpaths: `styles.css`, `types`, `format`, `categories`, `connection-health`, `hooks`, `primitives`,
`brand`, `shell`, `transactions`, `overview`, `accounts`, `cashflow`, `review`, `settings`, `rules`.
The exported names are listed in the root `local://ui-exports.md` note and in each `index.ts`.

## Notes

- Exports point at TypeScript sources; consumers compile them (Vite follows the workspace symlink, so the
  files are treated as app source, not as a prebundled dependency).
- `react` and `react-dom` are peer dependencies — the app owns the single React copy.
- Any SVG `id` (hatch patterns, clip paths) must come from `useId()`: the public site renders several of
  these components on one page.
- `oxlint` here keeps `react/rules-of-hooks` but not `react/only-export-components`: these files are a
  library, not fast-refresh boundaries, and most of them export a helper beside their component.

## Checks

```
bunx tsc --noEmit -p tsconfig.json
bun test
bunx oxlint
```
