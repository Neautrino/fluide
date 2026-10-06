/** Every route of the site and its document head. prerender.ts writes one HTML file per entry. */
export const PAGES: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Fluide: your bank accounts in one ledger, on your machine',
    description:
      "Fluide is a self-hosted finance app. It reads your accounts through Plaid, sorts transactions with rules and AI, asks you when it isn't sure, and answers questions from your own ledger.",
  },
  '/manifesto': {
    title: 'Manifesto · Fluide',
    description:
      "The rules Fluide is built on: read-only forever, your computer not ours, never guess quietly, a real ledger, show the work, AI you choose, and saying what isn't there yet.",
  },
  '/docs': {
    title: 'Docs · Fluide',
    description: 'Install Fluide on your own computer with Docker, keep it up to date, back it up, and see exactly what it sends where.',
  },
}

export const ROUTES = Object.keys(PAGES)
