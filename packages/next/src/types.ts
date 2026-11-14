import type { Many } from '@anievo-id/rbac-evolution'

export type MaybePromise<T> = T | Promise<T>

/**
 * What a guard requires — mirrors spatie's `permission`, `role` and `role_or_permission` middleware.
 * Arrays mean "any of" (like `permission:a|b`).
 */
export type Requirement =
  | { permission: Many<string>; role?: never; roleOrPermission?: never }
  | { permission?: never; role: Many<string>; roleOrPermission?: never }
  | { permission?: never; role?: never; roleOrPermission: Many<string> }

export type FailureReason = 'unauthenticated' | 'unauthorized'
