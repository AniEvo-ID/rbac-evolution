import type { SubjectRbac } from '@anievo-id/rbac-evolution'
import type { ExecutionContext } from '@nestjs/common'

export class RbacGuardMissingError extends Error {
  readonly code = 'RBAC_GUARD_MISSING'

  constructor() {
    super(
      '`@CurrentRbac()` was used but `RbacGuard` did not run for this route. Add a `@Require*()` decorator, ' +
        '`@UseGuards(RbacGuard)`, or `RbacModule.forRoot({ globalGuard: true })`.',
    )
    this.name = 'RbacGuardMissingError'
  }
}

/** Per-request resolved `SubjectRbac` (`null` for guests), keyed by the request/client/context object. */
const resolved = new WeakMap<object, SubjectRbac | null>()

/**
 * The object that identifies the current request: the HTTP request, the RPC context, the WebSocket client,
 * or (for GraphQL and other context types) the third handler argument.
 */
export function requestKey(context: ExecutionContext): object | undefined {
  let key: unknown
  switch (context.getType<string>()) {
    case 'http':
      key = context.switchToHttp().getRequest()
      break
    case 'rpc':
      key = context.switchToRpc().getContext()
      break
    case 'ws':
      key = context.switchToWs().getClient()
      break
    default:
      key = context.getArgByIndex(2)
  }
  return typeof key === 'object' && key !== null ? key : undefined
}

export function hasResolved(key: object): boolean {
  return resolved.has(key)
}

export function getResolved(key: object): SubjectRbac | null | undefined {
  return resolved.get(key)
}

export function setResolved(key: object, rbac: SubjectRbac | null): void {
  resolved.set(key, rbac)
}

/**
 * Returns the `SubjectRbac` that `RbacGuard` resolved for this execution context (`null` for guests).
 * Throws {@link RbacGuardMissingError} when the guard has not run.
 */
export function getRbac(context: ExecutionContext): SubjectRbac | null {
  const key = requestKey(context)
  if (key === undefined || !resolved.has(key)) throw new RbacGuardMissingError()
  return resolved.get(key) ?? null
}
