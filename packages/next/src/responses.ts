import type { Requirement } from './types'

/** Which kind of requirement failed — same values as the Express package. */
export type ForbiddenReason = 'permission' | 'role' | 'role_or_permission'

export function forbiddenReason(requirement: Requirement): ForbiddenReason {
  if (requirement.permission !== undefined) return 'permission'
  if (requirement.role !== undefined) return 'role'
  return 'role_or_permission'
}

/** Like spatie, the message names the kind of requirement but not the role/permission names. */
export function forbiddenMessage(requirement: Requirement): string {
  switch (forbiddenReason(requirement)) {
    case 'permission':
      return 'User does not have the right permissions.'
    case 'role':
      return 'User does not have the right roles.'
    default:
      return 'User does not have any of the necessary access rights.'
  }
}

/** `401 { error: 'UNAUTHENTICATED', message }` — same body as `@anievo-id/rbac-evolution-express`. */
export function unauthenticatedResponse(): Response {
  return Response.json({ error: 'UNAUTHENTICATED', message: 'User is not logged in.' }, { status: 401 })
}

/** `403 { error: 'FORBIDDEN', reason, message }` — same body as `@anievo-id/rbac-evolution-express`. */
export function forbiddenResponse(requirement: Requirement): Response {
  return Response.json(
    { error: 'FORBIDDEN', reason: forbiddenReason(requirement), message: forbiddenMessage(requirement) },
    { status: 403 },
  )
}
