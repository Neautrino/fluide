import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Enable Banking only redirects back to https URLs. WEB_TLS_CERT_PATH /
  // WEB_TLS_KEY_PATH (apps/web/.env, e.g. from `mkcert localhost`) turn https
  // on; without them the dev server stays on http and only Plaid can connect.
  const env = loadEnv(mode, process.cwd(), '')
  const https =
    env.WEB_TLS_CERT_PATH && env.WEB_TLS_KEY_PATH
      ? { cert: readFileSync(env.WEB_TLS_CERT_PATH), key: readFileSync(env.WEB_TLS_KEY_PATH) }
      : undefined

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 3000,
      https,
      proxy: {
        '/plaid': 'http://localhost:4000',
        '/enable-banking': 'http://localhost:4000',
        '/accounts': 'http://localhost:4000',
        '/transactions': 'http://localhost:4000',
        '/api': 'http://localhost:4000',
      },
    },
  }
})
