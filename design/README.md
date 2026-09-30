# design

The Fluide Studio design system and mockups of the app pages built with it. These are static, read-only HTML mockups. They are not wired into `apps/web`.

## How to open

Open `design/index.html` in a browser. It is the design system page; section 08 links to the nine app pages. The pages link to each other through their sidebar. The theme button (◐) and "hide amounts" persist across pages (localStorage).

Fonts (Archivo, Plus Jakarta Sans, Geist Mono) load from Google Fonts, so they need an internet connection. Offline, the pages fall back to system fonts.

## Files

- `index.html`: design system 01 (Fluide Studio): idea, colour, type, shape, charts, components, an earlier Overview composition, and links to the app pages.
- `shared/tokens.css`: design tokens (light and dark themes) used by every page.
- `pages/overview.html`, `transactions.html`, `accounts.html`, `cashflow.html`, `upcoming.html`, `review.html`, `rules.html`, `assistant.html`, `settings.html`: the app page mockups.
- `OVERVIEW-SPEC.md`: the agreed spec for the Overview page.

## In the app

`apps/web/src/index.css` carries its own copy of these tokens (fonts bundled via `@fontsource-variable`, no Google Fonts). A token change goes in both files. Pages are being moved onto the design one feature at a time.
