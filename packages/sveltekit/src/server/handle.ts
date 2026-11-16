import type {
  CheckGuard,
  DefaultGuardName,
  DefaultRbacTypes,
  GuardOptions,
  PermissionName,
  Rbac,
  RbacSnapshot,
  RbacTypeConfig,
  ScopedGuardName,
  Subject,
  SubjectRbac,
  TeamId,
} from '@anievo-id/rbac-evolution'
import type { RequestEvent } from '@sveltejs/kit'
import type { TypesOf } from '../types.js'

type MaybePromise<T> = T | Promise<T>

/**
 * The `handle` hook `rbacHandle()` returns. It fits SvelteKit's `Handle` (exported by `@sveltejs/kit` in SvelteKit 2
 * and by `@sveltejs/kit/hooks` in SvelteKit 3), so export it as `handle` or pass it to `sequence()`.
 */
export type RbacHandle = (input: {
  event: RequestEvent
  resolve: (event: RequestEvent) => MaybePromise<Response>
}) => Promise<Response>

/**
 * What `rbacHandle()` puts on `event.locals`. Extend `App.Locals` with it in `src/app.d.ts`:
 *
 * ```ts
 * import type { RbacLocals } from '@anievo-id/rbac-evolution-sveltekit/server'
 * import type { AppRbac } from '$lib/server/rbac'
 *
 * declare global {
 *   namespace App {
 *     interface Locals extends RbacLocals<AppRbac> {}
 *   }
 * }
 * ```
 *
 * `T` is a names type like `AppRbac` (or `typeof rbac`); without it, any name. With per-guard names, `G` is the
 * guard of the hook (its `guard` option): the default guard's names by default.
 */
export interface RbacLocals<
  T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes,
  G extends string = DefaultGuardName<TypesOf<T>>,
> {
  /** Roles & permissions of the current subject. `null` for guests. */
  rbac: SubjectRbac<TypesOf<T>, ScopedGuardName<TypesOf<T>, G>> | null
}

/** The part of a SvelteKit `RequestEvent` the server helpers read. Every `load`, action and endpoint event has it. */
export interface RbacEvent {
  locals: object
}

export interface RbacHandleOptions<T extends RbacTypeConfig = DefaultRbacTypes, G extends string = DefaultGuardName<T>> {
  /** The RBAC engine created with `createRbac(...)`. Its typed names flow into `event.locals.rbac`. */
  rbac: Rbac<T>
  /**
   * Resolves the authenticated subject for this request (e.g. from `event.locals.user` set by your auth hook, or a
   * session cookie). Return `null` / `undefined` for guests.
   */
  getSubject: (event: RequestEvent) => MaybePromise<Subject | null | undefined>
  /**
   * Guard name (e.g. `web` or `api`). Defaults to the engine's `defaultGuard`. With per-guard names, it must be one
   * of the typed guards (checked by `rbacHandle()`).
   */
  guard?: G | undefined
  /** Resolves the current team (only when the engine was created with `teams: true`). */
  team?: ((event: RequestEvent) => MaybePromise<TeamId | undefined>) | undefined
}

/** Thrown when a helper runs without `rbacHandle()` in `src/hooks.server.ts`. */
export class RbacHandleMissingError extends Error {
  readonly code = 'RBAC_HANDLE_MISSING'

  constructor() {
    super('`event.locals.rbac` is not set. Add `rbacHandle()` to `handle` in src/hooks.server.ts.')
    this.name = 'RbacHandleMissingError'
  }
}

/**
 * A SvelteKit `handle` hook that resolves the current subject once per request and sets `event.locals.rbac`
 * (a `SubjectRbac`, or `null` for guests).
 *
 * ```ts
 * // src/hooks.server.ts
 * import { sequence } from '@sveltejs/kit/hooks'
 * import { rbacHandle } from '@anievo-id/rbac-evolution-sveltekit/server'
 *
 * export const handle = sequence(
 *   authHandle, // yours: sets event.locals.user
 *   rbacHandle({ rbac, getSubject: (event) => (event.locals.user ? { type: 'user', id: event.locals.user.id } : null) }),
 * )
 * ```
 *
 * Nothing is loaded from the database here: `rbac.for(subject)` is lazy, so only the checks a request makes hit
 * the adapter (or the cache).
 */
export function rbacHandle<T extends RbacTypeConfig = DefaultRbacTypes, G extends string = DefaultGuardName<T>>(
  options: RbacHandleOptions<T, G> & (T extends { guards: object } ? GuardOptions<CheckGuard<T, G>> : unknown),
): RbacHandle {
  const { getSubject, team } = options
  const guard: string | undefined = options.guard
  // `T` only narrows the names on `event.locals.rbac`; the subject is the same object either way.
  const rbac = options.rbac as unknown as Rbac

  return async ({ event, resolve }) => {
    const subject = await getSubject(event)
    let value: SubjectRbac | null = null
    if (subject) {
      const teamId = team ? await team(event) : undefined
      value = rbac.for(subject, {
        ...(guard !== undefined && { guard }),
        ...(teamId !== undefined && { team: teamId }),
      })
    }
    ;(event.locals as { rbac?: SubjectRbac | null }).rbac = value
    return resolve(event)
  }
}

/** Reads `event.locals.rbac`, set by `rbacHandle()`. Throws {@link RbacHandleMissingError} when the hook is missing. */
export function getRbac<
  T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes,
  G extends string = DefaultGuardName<TypesOf<T>>,
>(event: RbacEvent): SubjectRbac<TypesOf<T>, ScopedGuardName<TypesOf<T>, G>> | null {
  const value = (event.locals as { rbac?: SubjectRbac | null }).rbac
  if (value === undefined) throw new RbacHandleMissingError()
  return value as SubjectRbac<TypesOf<T>, ScopedGuardName<TypesOf<T>, G>> | null
}

/** Options of {@link getSnapshot}. */
export interface GetSnapshotOptions<N extends string = string> {
  /**
   * Permission names to run the engine's `before` hook for. Those it denies are sent as `denied`, and the client
   * (`setRbacContext()`, `<Can>`) treats them as not allowed, super-admins included.
   */
  checkBefore?: readonly N[] | undefined
  /** Make the snapshot in this guard instead of the hook's (`subject.withScope({ guard })`). */
  guard?: string | undefined
}

/**
 * The current subject's `{ roles, permissions }` (plus `denied` with `checkBefore`), or `null` for guests. Return it
 * from the root `+layout.server.ts` and pass it to `setRbacContext()`:
 *
 * ```ts
 * // src/routes/+layout.server.ts
 * export const load = async (event) => ({ rbac: await getSnapshot(event, { checkBefore: ['billing.manage'] }) })
 * ```
 *
 * `getSnapshot<AppRbac>(event, ...)` checks the `checkBefore` names.
 */
export async function getSnapshot<
  T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes,
  G extends string = DefaultGuardName<TypesOf<T>>,
>(event: RbacEvent, options: GetSnapshotOptions<PermissionName<TypesOf<T>, G>> = {}): Promise<RbacSnapshot | null> {
  const subject = getRbac(event)
  if (subject === null) return null
  const scoped = options.guard === undefined ? subject : subject.withScope({ guard: options.guard })
  return scoped.snapshot(options.checkBefore === undefined ? {} : { checkBefore: options.checkBefore })
}
