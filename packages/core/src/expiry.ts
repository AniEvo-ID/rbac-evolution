import type { RbacAdapter } from './adapter'
import { RbacError } from './errors'
import type { Id, Permission, Role } from './types'

/**
 * Last argument of `assignRole()`, `givePermissionTo()`, `syncRoles()` and `syncPermissions()` on a subject.
 *
 * ```ts
 * await rbac.for(user).assignRole('on-call', { expiresAt: new Date(Date.now() + 8 * 3600_000) })
 * ```
 */
export interface ExpiryOptions {
  /**
   * When the given links stop granting access. From that instant on, every check treats them as absent.
   * `null` = never. Needs an adapter with expiry support (`{ expiry: true }`), else `EXPIRY_NOT_SUPPORTED`.
   *
   * `assignRole()` / `givePermissionTo()`: the latest call wins. Leaving it out makes the named links
   * permanent, also when the subject already held them with an expiry.
   * `syncRoles()` / `syncPermissions()`: with it, every listed link gets this expiry. Without it, links the
   * subject keeps keep their expiry, and newly added links are permanent.
   */
  expiresAt?: Date | null | undefined
}

/** Variadic names or objects, optionally followed by {@link ExpiryOptions}. */
export type ExpiryArgs<A> = A[] | [...A[], ExpiryOptions]

/** A role the subject holds, with the moment the assignment ends. From `getRoleAssignments()`. */
export interface RoleAssignment {
  role: Role
  /** `null` = permanent. */
  expiresAt: Date | null
}

/** A direct permission the subject holds, with the moment the grant ends. From `getDirectPermissionAssignments()`. */
export interface PermissionAssignment {
  permission: Permission
  /** `null` = permanent. */
  expiresAt: Date | null
}

const idKey = (id: Id): string => String(id)

/** @internal Splits `(...items, options?)`. Role and permission objects always have an `id`; options never do. */
export function splitExpiryArgs<A>(args: readonly (A | ExpiryOptions)[]): { items: A[]; options: ExpiryOptions | undefined } {
  const last = args[args.length - 1]
  if (last !== null && typeof last === 'object' && !Array.isArray(last) && !('id' in last)) {
    return { items: args.slice(0, -1) as A[], options: last as ExpiryOptions }
  }
  return { items: args as A[], options: undefined }
}

/**
 * @internal The expiry a write asks for: a `Date`, `null` (permanent), or `undefined` (not given).
 * Throws `EXPIRY_NOT_SUPPORTED` for a date the adapter can't store, never silently granting permanent access.
 */
export function requestedExpiry(options: ExpiryOptions | undefined, adapter: RbacAdapter): Date | null | undefined {
  const value = options?.expiresAt
  if (value === undefined || value === null) return value
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError('`expiresAt` must be a valid Date (or null for a permanent link).')
  }
  if (adapter.supportsExpiry !== true) {
    throw new RbacError(
      'EXPIRY_NOT_SUPPORTED',
      'An `expiresAt` was given, but the adapter does not store expiry. Create it with `{ expiry: true }` ' +
        'after adding the `expires_at` column (see the upgrade steps of your adapter).',
    )
  }
  return new Date(value.getTime())
}

/** @internal `true` when the link is still active at `now` (epoch ms). */
export const isActive = (expiresAt: Date | null | undefined, now: number): boolean =>
  expiresAt === undefined || expiresAt === null || expiresAt.getTime() > now

/** @internal Epoch ms of a stored expiry, or `null`. Accepts what adapters return (Date, ISO string, ms). */
export function expiryMs(expiresAt: Date | string | number | null | undefined): number | null {
  if (expiresAt === undefined || expiresAt === null) return null
  const ms = expiresAt instanceof Date ? expiresAt.getTime() : new Date(expiresAt).getTime()
  return Number.isNaN(ms) ? null : ms
}

/** @internal Earliest of the given epoch ms values, or `undefined`. */
export function earliest(values: Iterable<number | null>): number | undefined {
  let min: number | undefined
  for (const v of values) if (v !== null && (min === undefined || v < min)) min = v
  return min
}

/** @internal Active links as `id → expiry ms (null = never)`, in first-seen order. */
export type ActiveLinks = Map<string, { id: Id; expiresAt: number | null }>

/** @internal Builds {@link ActiveLinks} from link rows, dropping those expired at `now`. */
export function activeLinks<L>(
  links: readonly L[],
  id: (link: L) => Id,
  expiresAt: (link: L) => Date | null | undefined,
  now: number,
): ActiveLinks {
  const out: ActiveLinks = new Map()
  for (const link of links) {
    const ms = expiryMs(expiresAt(link))
    if (ms !== null && ms <= now) continue
    const k = idKey(id(link))
    const previous = out.get(k)
    // Duplicates should not happen; keep the later expiry so a check never ends too early.
    if (previous === undefined || (previous.expiresAt !== null && (ms === null || ms > previous.expiresAt))) {
      out.set(k, { id: id(link), expiresAt: ms })
    }
  }
  return out
}
