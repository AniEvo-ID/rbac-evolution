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

/** A permission can be referenced by its name or by the permission object itself. */
export type PermissionInput = string | Permission

/** A role can be referenced by its name or by the role object itself. */
export type RoleInput = string | Role

/** Lets methods accept both `fn('a', 'b')` and `fn(['a', 'b'])`. */
export type Many<T> = T | readonly T[]

/** Serializable summary of a subject's access — handy for sending to the client (React, Vue, ...). */
export interface RbacSnapshot {
  roles: string[]
  permissions: string[]
}
