import { InvalidWildcardPermission, RbacError } from './errors'
import { isDevelopment, warnOnce } from './warn'

export const WILDCARD_TOKEN = '*'
export const PART_DELIMITER = '.'
export const SUBPART_DELIMITER = ','

/**
 * Splits a permission into parts and subparts.
 *
 * `articles.edit,delete.own` → `[['articles'], ['edit', 'delete'], ['own']]`
 */
export function parseWildcardPermission(permission: string): string[][] {
  const trimmed = permission.trim()
  if (trimmed === '') throw new InvalidWildcardPermission(permission)

  return trimmed.split(PART_DELIMITER).map((part) => {
    const subparts = part.split(SUBPART_DELIMITER).map((s) => s.trim())
    if (subparts.some((s) => s === '')) throw new InvalidWildcardPermission(permission)
    return subparts
  })
}

/**
 * Returns `true` when the `granted` permission covers the `required` one.
 *
 * - `*` covers everything.
 * - `articles.*` covers `articles.edit`, `articles.edit.own`, ...
 * - `articles` covers `articles.edit` (a shorter permission implies everything below it).
 * - `articles.edit,delete` covers `articles.edit` and `articles.delete`, not `articles.create`.
 * - `articles.edit` does NOT cover `articles.*` or `articles`.
 */
export function wildcardImplies(granted: string, required: string): boolean {
  const grantedParts = parseWildcardPermission(granted)
  const requiredParts = parseWildcardPermission(required)

  for (let i = 0; i < grantedParts.length; i++) {
    const grantedPart = grantedParts[i]!
    const requiredPart = requiredParts[i]

    // Required permission is shorter: the remaining granted parts must all be wildcards.
    if (requiredPart === undefined) {
      return grantedParts.slice(i).every((part) => part.includes(WILDCARD_TOKEN))
    }

    if (grantedPart.includes(WILDCARD_TOKEN)) continue
    if (requiredPart.includes(WILDCARD_TOKEN)) return false
    if (!requiredPart.every((sub) => grantedPart.includes(sub))) return false
  }

  // Granted permission is shorter or equal: it implies everything below it.
  return true
}

/** Parses a permission, or returns `null` when it is not a valid wildcard permission. */
function tryParse(permission: string): string[][] | null {
  try {
    return parseWildcardPermission(permission)
  } catch {
    return null
  }
}

/**
 * @internal Pairs `[shorter, longer]` of names where `shorter` has no `*` part but still implies `longer`, only
 * because it has fewer parts: `orders.refund` implies `orders.refund.large`. That rule is easy to miss, so the
 * engine warns about it (see `RbacOptions.wildcardPrefixCheck`). Names with a `*` part are not reported as the
 * shorter one: there the wide match is the intent.
 *
 * With `focus`, only pairs where at least one of the two names is in `focus` are returned.
 */
export function findPrefixImplications(
  names: readonly string[],
  focus?: ReadonlySet<string>,
): Array<[shorter: string, longer: string]> {
  const parsed: Array<[string, string[][]]> = []
  for (const name of new Set(names)) {
    const parts = tryParse(name)
    if (parts) parsed.push([name, parts])
  }
  const pairs: Array<[string, string]> = []
  for (const [shorter, shortParts] of parsed) {
    if (shortParts.some((part) => part.includes(WILDCARD_TOKEN))) continue
    for (const [longer, longParts] of parsed) {
      if (longParts.length <= shortParts.length) continue
      if (focus && !focus.has(shorter) && !focus.has(longer)) continue
      // Same rule as `wildcardImplies` for a granted name without `*` that is shorter than the required one.
      const implies = shortParts.every((part, i) => {
        const required = longParts[i]!
        return !required.includes(WILDCARD_TOKEN) && required.every((sub) => part.includes(sub))
      })
      if (implies) pairs.push([shorter, longer])
    }
  }
  return pairs
}

/**
 * What the engine does when, with `wildcard: true`, one permission name implies another only because it is
 * shorter (`orders.refund` implies `orders.refund.large`). See `RbacOptions.wildcardPrefixCheck`.
 *
 * - `'warn'`: log a one-time `console.warn` per pair when `NODE_ENV` is `development` (the default).
 * - `'error'`: throw an `RbacError` with code `INVALID_WILDCARD_PERMISSION`, before anything is written.
 * - `'off'`: say nothing.
 */
export type WildcardPrefixCheck = 'warn' | 'error' | 'off'

/** @internal Whether a check in this mode can have an effect (skips the work in production with `'warn'`). */
export function prefixCheckActive(mode: WildcardPrefixCheck): boolean {
  return mode === 'error' || (mode === 'warn' && isDevelopment())
}

/** @internal Warns about or throws for the pairs found by {@link findPrefixImplications}. */
export function reportPrefixImplications(
  mode: WildcardPrefixCheck,
  pairs: ReadonlyArray<readonly [string, string]>,
  guardName: string,
): void {
  const message = (list: ReadonlyArray<readonly [string, string]>): string =>
    `${list.map(([a, b]) => `\`${a}\` also grants \`${b}\``).join(', ')} (guard \`${guardName}\`): with wildcards, ` +
    'a shorter name implies the longer ones. Rename one, or see the `wildcardPrefixCheck` option.'
  if (mode === 'off') return
  if (mode === 'error' && pairs.length > 0) throw new RbacError('INVALID_WILDCARD_PERMISSION', message(pairs))
  for (const pair of pairs) warnOnce(`wildcard-prefix:${JSON.stringify([guardName, ...pair])}`, message([pair]))
}
