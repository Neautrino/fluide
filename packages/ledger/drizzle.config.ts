import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://fluide:fluide_dev_only@localhost:5433/fluide',
  },
})
