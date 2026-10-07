import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Plugin, ResolvedConfig } from 'vite'

/** What src/entry-server.tsx exports; the SSR build is imported once, here, after both builds finish. */
type ServerEntry = {
  ROUTES: readonly string[]
  PAGES: Record<string, { title: string; description: string }>
  render: (url: string) => Promise<string>
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** Replaces the attribute value that follows `before` (e.g. `<meta property="og:url" content="`). */
function setAttr(html: string, before: string, value: string) {
  const start = html.indexOf(before)
  if (start < 0) throw new Error(`prerender: index.html has no ${before}…"`)
  const from = start + before.length
  return html.slice(0, from) + escapeHtml(value) + html.slice(html.indexOf('"', from))
}

/**
 * Renders every route of the built site to static HTML: the client build's index.html is the template,
 * the SSR build renders the app into #root, and each route gets its own title, description, link-preview
 * tags and canonical URL (on the origin of the template's og:url).
 * Writes dist/index.html, dist/<route>/index.html; the client bundle hydrates them.
 */
export async function prerender(client: ResolvedConfig, server: ResolvedConfig) {
  const outDir = path.resolve(client.root, client.build.outDir)
  const serverDir = path.resolve(server.root, server.build.outDir)
  // the SSR bundle only exists once this build has written it, so it can't be a static import
  const entry = (await import(pathToFileURL(path.join(serverDir, 'entry-server.js')).href)) as ServerEntry
  const template = await readFile(path.join(outDir, 'index.html'), 'utf8')
  if (!template.includes('<div id="root"></div>')) throw new Error('prerender: index.html has no empty <div id="root"></div>')
  const origin = /<meta property="og:url" content="([^"]+)"/.exec(template)?.[1]
  if (!origin) throw new Error('prerender: index.html has no og:url')

  for (const url of entry.ROUTES) {
    const page = entry.PAGES[url]
    const pageUrl = new URL(url, origin).href
    const app = await entry.render(url)
    let html = template.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(page.title)}</title>`)
    html = setAttr(html, '<meta name="description" content="', page.description)
    html = setAttr(html, '<meta property="og:title" content="', page.title)
    html = setAttr(html, '<meta property="og:description" content="', page.description)
    html = setAttr(html, '<meta property="og:url" content="', pageUrl)
    html = setAttr(html, '<link rel="canonical" href="', pageUrl)
    html = html.replace('<div id="root"></div>', `<div id="root">${app}</div>`)
    const file = path.join(outDir, url, 'index.html')
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, html)
    client.logger.info(`prerendered ${path.relative(client.root, file)}`)
  }
  await rm(serverDir, { recursive: true, force: true })
}

/** `vite preview` serves /docs from docs/index.html, as a static host does (Vite only maps /docs/). */
export function previewPrerendered(): Plugin {
  return {
    name: 'docs:preview-prerendered',
    configurePreviewServer(server) {
      const outDir = path.resolve(server.config.root, server.config.build.outDir)
      server.middlewares.use((req, _res, next) => {
        const [pathname, query = ''] = (req.url ?? '').split('?')
        if (!pathname.endsWith('/') && existsSync(path.join(outDir, pathname, 'index.html')))
          req.url = `${pathname}/index.html${query && `?${query}`}`
        next()
      })
    },
  }
}
