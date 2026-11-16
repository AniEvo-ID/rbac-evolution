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
 */
export interface RbacTypeConfig {
  permissions?: string | undefined
  roles?: string | undefined
}

/** Default type configuration: any string is a valid permission / role name. */
export interface DefaultRbacTypes {
  permissions: string
  roles: string
}

/** Permission names accepted by an `Rbac<T>` (string enums also accept their literal values). */
export type PermissionName<T extends RbacTypeConfig = DefaultRbacTypes> = T extends {
  permissions: infer P extends string
}
  ? P | `${P}`
  : string

/** Role names accepted by an `Rbac<T>` (string enums also accept their literal values). */
export type RoleName<T extends RbacTypeConfig = DefaultRbacTypes> = T extends { roles: infer R extends string }
  ? R | `${R}`
  : string

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
export interface SnapshotOptions<T extends RbacTypeConfig = DefaultRbacTypes> {
  /**
   * Permission names to run the `before` hook for. Those it denies (returns `false` for) are listed in the
   * snapshot's `denied`, which the React and Vue packages honour. Default: none, and the snapshot has no `denied`.
   */
  checkBefore?: readonly PermissionName<T>[] | undefined
}
