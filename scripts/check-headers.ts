// Enforces the "Source-of-truth file headers" rule in AGENTS.md.
// Run from the repo root: bun scripts/check-headers.ts
import { Glob } from 'bun'

// The only files allowed (and required) to carry a SOURCE OF TRUTH header.
const ALLOWED = new Set([
  'apps/server/src/audit.ts',
  'apps/server/src/categorization/categorize.ts',
  'apps/server/src/categorization/gate.ts',
  'apps/server/src/categorization/rules.ts',
  'apps/server/src/chat/tools.ts',
  'apps/server/src/connection-store.ts',
  'apps/server/src/connector-errors.ts',
  'apps/server/src/enable-banking-link.ts',
  'apps/server/src/ingest.ts',
  'apps/server/src/provider-credentials.ts',
  'apps/server/src/review.ts',
  'apps/server/src/settings.ts',
  'apps/server/src/vault.ts',
  'packages/connectors/src/enable-banking.ts',
  'packages/connectors/src/errors.ts',
  'packages/connectors/src/plaid.ts',
  'packages/connectors/src/types.ts',
  'packages/ledger/migrations/0001_ledger_guardrails.sql',
  'packages/ledger/migrations/0004_category_change_requires_audit.sql',
  'packages/ledger/src/schema/ledger.ts',
])

const MARKER = 'SOURCE OF TRUTH:'
const MAX_CONTENT_LINES = 4
const MAX_FIRST_LINE = 100
const FIELDS = ['Invariant:', 'Never:', 'See:']
const BANNED: [RegExp, string][] = [
  [/\b(WHAT|WHY|WHERE)( CHANGED)?:/, 'WHAT/WHY/WHERE field'],
  [/\bS\d+-\d+\b/, 'slice id'],
  [/\b\d{4}-\d{2}-\d{2}\b/, 'date'],
  [/\btemporary\b/i, '"temporary"'],
  [/\bfor now\b/i, '"for now"'],
  [/\bstill\b/i, '"still"'],
  [/\bswitched from\b/i, 'history ("switched from")'],
  [/\bconfirmed live\b/i, 'history ("confirmed live")'],
]

// Returns the header's content lines (comment markers stripped), or an error.
function readHeader(path: string, lines: string[]): string[] | string {
  if (path.endsWith('.sql')) {
    const content: string[] = []
    for (const line of lines) {
      if (!line.startsWith('--')) break
      content.push(line.replace(/^--\s?/, ''))
    }
    if (!content[0]?.startsWith(MARKER)) return `line 1 must start with "-- ${MARKER}"`
    return content
  }
  if (lines[0]?.startsWith('/**')) return 'header must open with /*, not /** (tsserver attaches /** to the next symbol)'
  if (!lines[0]?.startsWith(`/* ${MARKER}`)) return `line 1 must start with "/* ${MARKER}" (before the first import)`
  const end = lines.findIndex((line) => line.includes('*/'))
  if (end === -1) return 'header comment is never closed'
  return [lines[0].slice(3), ...lines.slice(1, end).map((line) => line.replace(/^ \*\s?/, ''))]
    .map((line) => line.replace(/\s*\*\/\s*$/, ''))
    .filter((line, i) => i === 0 || line !== '')
}

const errors: string[] = []
const found = new Set<string>()

for (const root of ['apps', 'packages']) {
  for await (const rel of new Glob('**/*.{ts,tsx,js,jsx,mjs,cjs,sql}').scan({ cwd: root })) {
    if (rel.includes('node_modules/') || rel.includes('dist/')) continue
    const path = `${root}/${rel}`
    const text = await Bun.file(path).text()
    if (!text.includes('SOURCE OF TRUTH')) continue
    found.add(path)
    if (!ALLOWED.has(path)) {
      errors.push(`${path}: has a SOURCE OF TRUTH header but is not in the allowed list`)
      continue
    }
    const header = readHeader(path, text.split('\n'))
    if (typeof header === 'string') {
      errors.push(`${path}: ${header}`)
      continue
    }
    if (header.length > MAX_CONTENT_LINES) errors.push(`${path}: ${header.length} content lines (max ${MAX_CONTENT_LINES})`)
    if (header[0]!.length > MAX_FIRST_LINE) errors.push(`${path}: first line is ${header[0]!.length} chars (max ${MAX_FIRST_LINE})`)
    for (const line of header.slice(1)) {
      if (!FIELDS.some((field) => line.startsWith(field))) errors.push(`${path}: line must start with one of ${FIELDS.join(' ')} -> "${line}"`)
    }
    for (const [pattern, label] of BANNED) {
      if (header.some((line) => pattern.test(line))) errors.push(`${path}: banned ${label}`)
    }
  }
}

for (const path of ALLOWED) {
  if (!found.has(path)) errors.push(`${path}: in the allowed list but has no SOURCE OF TRUTH header`)
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}
console.log(`${found.size} headers OK`)
