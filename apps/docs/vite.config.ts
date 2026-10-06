import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { prerender, previewPrerendered } from './prerender.ts'

// https://vite.dev/config/
// `vite build` builds the client, then an SSR bundle of src/entry-server.tsx, then writes one static
// HTML file per route (prerender.ts). See README.md.
export default defineConfig({
  plugins: [react(), tailwindcss(), previewPrerendered()],
  server: { port: 3001 },
  // the SSR bundle is only imported by prerender.ts at build time; bundling every dependency means it
  // can import @repo/ui's TypeScript sources and gsap's browser-only builds without a runtime loader
  ssr: { noExternal: true },
  environments: {
    ssr: {
      build: { ssr: 'src/entry-server.tsx', outDir: 'node_modules/.prerender', emptyOutDir: true },
    },
  },
  builder: {
    async buildApp(builder) {
      const { client, ssr } = builder.environments
      await builder.build(client)
      await builder.build(ssr)
      await prerender(client.config, ssr.config)
    },
  },
})
