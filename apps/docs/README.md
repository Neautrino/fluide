# docs

The public Fluide site: the landing (`/`), the manifesto (`/manifesto`) and the self-hosting guide
(`/docs`). Vite + React + Tailwind v4 + TanStack Router, styled with the DS01 design system from
`@repo/ui`, prerendered to one static HTML file per route.

```
bun run dev       # http://localhost:3001 (client-rendered, no prerender)
bun run build     # typecheck, client build, SSR build, prerender → dist/
bun run preview   # serve dist/
bun run lint
```

## Layout

```
src/
  entry-client.tsx, entry-server.tsx   browser entry (hydrate) and build-time render entry
  router.tsx, pages.ts                 routes and each route's <title>/description
  routes/        one component per page: Landing, Manifesto, Docs, and Root (nav + footer around them)
  landing/       the landing's sections, each with its own CSS where Tailwind can't express it
  site/          site chrome shared by every page: SiteNav, SiteFooter, HashLink, SectionTag, ds.ts
  app-preview/   the real app rendered on sample data: AppWindowDemo (framed window), AppViews (the six
                 views), sample/ (fixtures and the props derived from them)
  motion/        Lenis + GSAP setup and the section entrances
  lib/           hydration helpers (useHydrated, ClientOnly) and noop
```

## How the prerender works

`vite build` runs `builder.buildApp` from `vite.config.ts`:

1. builds the client (`index.html` → `src/entry-client.tsx`) into `dist/`;
2. builds `src/entry-server.tsx` for SSR into `node_modules/.prerender/` (every dependency bundled);
3. `prerender.ts` imports that bundle and, for every route in `src/pages.ts`, renders the app with a
   router on a memory history (`createMemoryHistory` + `router.load()` + `react-dom/server`
   `renderToString`), puts the HTML into `<div id="root">` of the built `dist/index.html`, sets the
   route's `<title>` and description, and writes `dist/index.html`, `dist/manifesto/index.html`,
   `dist/docs/index.html`. The SSR bundle is deleted afterwards.

In the browser, `src/entry-client.tsx` creates the router on the browser history, waits for
`router.load()` so the first render matches the prerendered HTML, and calls `hydrateRoot`. The dev
server serves an empty `#root`, so there it renders with `createRoot` instead. Client-side navigation
updates the title and description from the same `src/pages.ts`.

Two details keep this working:
- On the server, `RouterProvider` leaves out a `<Suspense>` that it renders in the browser (TanStack's
  full SSR protocol accounts for that; a static site doesn't need it). `src/entry-server.tsx` adds the
  same boundary through the router's `InnerWrap` option, so the HTML hydrates without a mismatch.
- `vite preview` only maps `/docs/` to `docs/index.html`; the `previewPrerendered` plugin in
  `prerender.ts` maps `/docs` too, as static hosts do. Whatever hosts `dist/` must do the same.

Adding a route: add it to `src/router.tsx` and give it an entry in `src/pages.ts`.

There are no loaders and no data fetching: every page is static, so the router needs nothing
dehydrated for the client.

## Motion

- `index.html`'s inline script sets `html.is-motion` (wide screen, motion allowed) and `html.rv-on`
  (motion allowed) before first paint.
- `src/motion/MotionProvider.tsx` runs Lenis smooth scrolling, driven by the GSAP ticker and feeding
  ScrollTrigger, only while `(min-width: 1180px) and (prefers-reduced-motion: no-preference)` matches.
  `useMotion()` reads it.
- `src/motion/reveal.tsx` is the section entrance (`useRevealScope` + `<Reveal kind>`); its hidden
  state is CSS in `src/index.css`, keyed on `html.rv-on`, so prerendered pages don't flash and nothing
  is hidden under reduced motion.
