import {
  REQUIREMENT_MESSAGES,
  type RequirementKind,
  UNAUTHENTICATED_MESSAGE,
} from '@anievo-id/rbac-evolution'
import { TRPCError } from '@trpc/server'

/**
 * Why a guard denied a call: the same body the other integrations send with their 401 / 403 responses
 * (`error`, `reason`, `message`, and `required` only with `exposeRequirements: true`).
 */
export type RbacErrorBody =
  | { error: 'UNAUTHENTICATED'; message: string }
  | { error: 'FORBIDDEN'; reason: RequirementKind; message: string; required?: string[][] }

/**
 * The `cause` of the `TRPCError` a guard throws by default. It carries the {@link RbacErrorBody}, which
 * `rbacErrorFormatter` (or `getRbacErrorBody()`) puts where clients can read it.
 */
export class RbacAccessError extends Error {
  readonly code = 'RBAC_ACCESS_DENIED'
  /** The 401 / 403 body of the other integrations. */
  readonly body: RbacErrorBody
  /** HTTP-style status: `401` (no subject) or `403` (missing role/permission). */
  readonly status: 401 | 403

  constructor(body: RbacErrorBody) {
    super(body.message)
    this.name = 'RbacAccessError'
    this.body = body
    this.status = body.error === 'UNAUTHENTICATED' ? 401 : 403
  }
}

/** Thrown when a guard runs without a subject resolver: `ctx.rbac` is `undefined` and `createGuards()` has no `resolve`. */
export class RbacContextMissingError extends Error {
  readonly code = 'RBAC_CONTEXT_MISSING'

  constructor() {
    super(
      '`ctx.rbac` is not set. Return it from `createContext` (see `createRbacContext()`), or pass `resolve` to `createGuards()`.',
    )
    this.name = 'RbacContextMissingError'
  }
}

/** The default error for a call without a subject: `TRPCError` `UNAUTHORIZED`. */
export function unauthenticatedError(): TRPCError {
  const body: RbacErrorBody = { error: 'UNAUTHENTICATED', message: UNAUTHENTICATED_MESSAGE }
  return new TRPCError({ code: 'UNAUTHORIZED', message: body.message, cause: new RbacAccessError(body) })
}

/** The default error for a subject without access: `TRPCError` `FORBIDDEN`. */
export function forbiddenError(kind: RequirementKind, requirements?: string[][]): TRPCError {
  const body: RbacErrorBody = {
    error: 'FORBIDDEN',
    reason: kind,
    message: REQUIREMENT_MESSAGES[kind],
    ...(requirements !== undefined && { required: requirements }),
  }
  return new TRPCError({ code: 'FORBIDDEN', message: body.message, cause: new RbacAccessError(body) })
}

/** Duck-typed, so it also works when two copies of this package are installed. */
const isAccessError = (value: unknown): value is RbacAccessError =>
  value instanceof Error &&
  (value as { code?: unknown }).code === 'RBAC_ACCESS_DENIED' &&
  typeof (value as { body?: unknown }).body === 'object'

/**
 * The {@link RbacErrorBody} of an error thrown by a guard (the `TRPCError`, or its `RbacAccessError` cause), or
 * `null` for any other error.
 */
export function getRbacErrorBody(error: unknown): RbacErrorBody | null {
  if (isAccessError(error)) return error.body
  if (error instanceof Error && isAccessError(error.cause)) return error.cause.body
  return null
}

/**
 * An `errorFormatter` that adds the guard's {@link RbacErrorBody} to the error shape as `data.rbac` (`null` for
 * other errors), so clients can read `error.data.rbac.reason`:
 *
 * ```ts
 * const t = initTRPC.context<Context>().create({ errorFormatter: rbacErrorFormatter })
 * ```
 *
 * To combine it with your own formatter, call it first and extend what it returns.
 */
export function rbacErrorFormatter<S extends { data: object }>(opts: {
  shape: S
  error: unknown
}): S & { data: S['data'] & { rbac: RbacErrorBody | null } } {
  const { shape, error } = opts
  return { ...shape, data: { ...shape.data, rbac: getRbacErrorBody(error) } }
}
