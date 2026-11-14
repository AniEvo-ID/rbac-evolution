import { InvalidWildcardPermission } from './errors'

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
