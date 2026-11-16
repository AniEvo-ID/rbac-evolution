/**
 * @internal Development-only, one-time warnings (the mechanism the versioning policy describes for deprecations).
 *
 * Runtime-agnostic: reads `NODE_ENV` through `globalThis.process`, so edge runtimes without `process` simply
 * never warn.
 */

const shown = new Set<string>()

/** `true` when `NODE_ENV` is `development`. */
export function isDevelopment(): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
  return env?.['NODE_ENV'] === 'development'
}

/** Logs `message` with `console.warn` once per `key`, only when `NODE_ENV` is `development`. */
export function warnOnce(key: string, message: string): void {
  if (!isDevelopment() || shown.has(key)) return
  shown.add(key)
  console.warn(`[rbac-evolution] ${message}`)
}

/** @internal Forgets which warnings were shown. For tests. */
export function resetWarnings(): void {
  shown.clear()
}
