/** Primary key type used by adapters (auto-increment number, UUID string, ObjectId string, ...). */
export type Id = string | number

/** Team identifier. `null` means "no team" (global). */
export type TeamId = Id | null

export interface Permission {
  id: Id
  name: string
  guardName: string
}

export interface Role {
  id: Id
  name: string
  guardName: string
  /** `null` for global roles. Only used when `teams` is enabled. */
  teamId: TeamId
}

/**
 * Anything that can hold roles and permissions — usually a user,
 * but can be any model (e.g. an API client, a service account).
 * Equivalent to Laravel's `model_type` + `model_id`.
 */
export interface Subject {
  type: string
  id: Id
}

/**
 * A permission can be referenced by its name or by the permission object itself.
 * `P` narrows the accepted names (see {@link RbacTypeConfig}); defaults to any string.
 */
export type PermissionInput<P extends string = string> = P | Permission

/**
 * A role can be referenced by its name or by the role object itself.
 * `R` narrows the accepted names (see {@link RbacTypeConfig}); defaults to any string.
 */
export type RoleInput<R extends string = string> = R | Role

/**
 * Type-level configuration of an `Rbac` instance — the equivalent of spatie's enums.
 *
 * ```ts
 * const rbac = createRbac<{ permissions: 'edit articles' | 'delete articles'; roles: 'writer' }>({ adapter })
 * await rbac.for(user).can('edit articles') // ok
 * await rbac.for(user).can('fly')           // type error
 * ```
 *
 * Both keys are optional; a missing key accepts any string. TS string enums work too.
 *
 * To type the names of each guard separately, use `guards` (and `defaultGuard` when it is not `web`) instead:
 *
 * ```ts
 * type AppRbac = {
 *   guards: {
 *     web: { roles: 'admin' | 'editor'; permissions: 'articles.edit' | 'api-keys.manage' }
 *     api: { roles: 'read-only' | 'full-access'; permissions: 'orders.read' | 'orders.write' }
 *   }
 *   defaultGuard: 'web'
 * }
 * ```
 *
 * Names then follow the guard in use: `rbac.for(user)` takes the default guard's names,
 * `rbac.for(key, { guard: 'api' })` the `api` names. With `guards`, the top-level `roles` / `permissions` are
 * not used.
 */
export interface RbacTypeConfig {
  permissions?: string | undefined
  roles?: string | undefined
  /**
   * Names per guard: `{ web: { roles: ...; permissions: ... }; api: { ... } }`, each shaped like
   * {@link RbacGuardTypes}. Only those guards are accepted as a `guard` option. Default: none (one set of names
   * for every guard, from `roles` / `permissions`).
   */
  guards?: object | undefined
  /** With `guards`: the guard used when none is given. Must match `createRbac({ defaultGuard })`. Default: `'web'`. */
  defaultGuard?: string | undefined
}

/** The names of one guard in `RbacTypeConfig['guards']`. Both keys are optional; a missing key accepts any string. */
export interface RbacGuardTypes {
  permissions?: string | undefined
  roles?: string | undefined
}

/** Default type configuration: any string is a valid permission / role name. */
export interface DefaultRbacTypes {
  permissions: string
  roles: string
}

/**
 * The guards typed in `T` (the keys of `T['guards']`), or `string` when `T` has no `guards`: then any guard
 * is accepted and every guard has the same names.
 */
export type GuardName<T extends RbacTypeConfig = DefaultRbacTypes> = T extends { guards: infer Gs extends object }
  ? keyof Gs & string
  : string

/**
 * The guard whose names apply when no `guard` is given: `T['defaultGuard']` (default `'web'`) with `guards`,
 * `string` (all guards share the names) without.
 */
export type DefaultGuardName<T extends RbacTypeConfig = DefaultRbacTypes> = T extends { guards: object }
  ? T extends { defaultGuard: infer D extends string }
    ? D
    : 'web'
  : string

/**
 * The names of guard `G` in `T`: `T` itself without `guards`, else `T['guards'][G]`. A `G` that is not one of
 * the typed guards (e.g. a plain `string`) gets the names of every guard.
 */
type GuardTypes<T, G> = T extends { guards: infer Gs } ? (G extends keyof Gs ? Gs[G] : Gs[keyof Gs]) : T

type PermissionsOf<C> = C extends { permissions: infer P extends string } ? P | `${P}` : string
type RolesOf<C> = C extends { roles: infer R extends string } ? R | `${R}` : string

/**
 * Permission names accepted by an `Rbac<T>` (string enums also accept their literal values).
 * With per-guard names (`T['guards']`), the names of guard `G`: the default guard's by default, every guard's
 * for `G = string`.
 */
export type PermissionName<
  T extends RbacTypeConfig = DefaultRbacTypes,
  G extends string = DefaultGuardName<T>,
> = PermissionsOf<GuardTypes<T, G>>

/**
 * Role names accepted by an `Rbac<T>` (string enums also accept their literal values).
 * With per-guard names (`T['guards']`), the names of guard `G`: the default guard's by default, every guard's
 * for `G = string`.
 */
export type RoleName<T extends RbacTypeConfig = DefaultRbacTypes, G extends string = DefaultGuardName<T>> = RolesOf<
  GuardTypes<T, G>
>

/**
 * The type of a `guard` option that selects the names of guard `G`: one of `GuardName<T>`, or any `string`
 * (then the names of every guard apply). An unknown literal is a type error that lists the typed guards.
 * Without `guards` in `T`, any string.
 */
export type CheckGuard<T extends RbacTypeConfig, G extends string> = string extends G
  ? string
  : G extends GuardName<T>
    ? G
    : GuardName<T>

/** The guard a scope chosen with `{ guard: G }` has at the type level: `G` with `guards` in `T`, else `string`. */
export type ScopedGuardName<T extends RbacTypeConfig, G extends string> = T extends { guards: object } ? G : string

/** Lets methods accept both `fn('a', 'b')` and `fn(['a', 'b'])`. */
export type Many<T> = T | readonly T[]

/** Serializable summary of a subject's access — handy for sending to the client (React, Vue, ...). */
export interface RbacSnapshot {
  roles: string[]
  permissions: string[]
  /**
   * Permission names the server's `before` hook denies to this subject, so the UI hides them even for a
   * super-admin. Only present when the snapshot was made with `snapshot({ checkBefore: [...] })`; a snapshot
   * without it behaves as before.
   */
  denied?: string[] | undefined
}

/** Options of `rbac.for(user).snapshot()`. */
export interface SnapshotOptions<T extends RbacTypeConfig = DefaultRbacTypes, G extends string = DefaultGuardName<T>> {
  /**
   * Permission names to run the `before` hook for. Those it denies (returns `false` for) are listed in the
   * snapshot's `denied`, which the React and Vue packages honour. Default: none, and the snapshot has no `denied`.
   */
  checkBefore?: readonly PermissionName<T, G>[] | undefined
}
