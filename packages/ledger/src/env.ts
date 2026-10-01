import { readFileSync } from 'node:fs'

const fromFile = new Map<string, string | undefined>()

/** `process.env[name]` if non-empty, else the contents of the file named by
 * `${name}_FILE` (read once, trailing whitespace trimmed), else undefined. */
export function secretEnv(name: string): string | undefined {
  const direct = process.env[name]
  if (direct) return direct
  if (fromFile.has(name)) return fromFile.get(name)
  const path = process.env[`${name}_FILE`]
  const value = path ? readFileSync(path, 'utf8').trimEnd() || undefined : undefined
  fromFile.set(name, value)
  return value
}
