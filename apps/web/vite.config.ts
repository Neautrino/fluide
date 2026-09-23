import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/plaid': 'http://localhost:4000',
      '/accounts': 'http://localhost:4000',
      '/transactions': 'http://localhost:4000',
    },
  },
})
