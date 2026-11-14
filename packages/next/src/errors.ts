import type { FailureReason } from './types'

/** Thrown by `withPermission()` / `withRole()` wrapped server actions when access is denied. */
export class RbacUnauthorizedError extends Error {
  /** `unauthenticated` (no subject) or `unauthorized` (missing role/permission). */
  readonly reason: FailureReason
  /** HTTP-style status: `401` or `403`. */
  readonly status: 401 | 403

  constructor(reason: FailureReason, message?: string) {
    super(message ?? (reason === 'unauthenticated' ? 'Unauthenticated.' : 'This action is unauthorized.'))
    this.name = 'RbacUnauthorizedError'
    this.reason = reason
    this.status = reason === 'unauthenticated' ? 401 : 403
  }
}
