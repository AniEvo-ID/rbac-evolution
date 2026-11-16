import type {
  DefaultGuardName,
  DefaultRbacTypes,
  Rbac,
  RbacTypeConfig,
  ScopedGuardName,
  SubjectRbac,
} from '@anievo-id/rbac-evolution'
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

/** The type configuration of `T`: `T` itself, or the `X` of an `Rbac<X>` engine. */
export type TypesOf<T> = T extends Rbac<infer X> ? X : T extends RbacTypeConfig ? T : never

/**
 * Returns the `SubjectRbac` that `RbacGuard` resolved for this execution context (`null` for guests).
 * Throws {@link RbacGuardMissingError} when the guard has not run.
 *
 * `getRbac<AppRbac>(context)` (or `getRbac<typeof rbac>(context)`) types it with the engine's names. With per-guard
 * names, `getRbac<AppRbac, 'api'>(context)` types it with the names of guard `api` (the guard of `RbacModule`);
 * the default guard's names without it.
 */
export function getRbac<
  T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes,
  G extends string = DefaultGuardName<TypesOf<T>>,
>(context: ExecutionContext): SubjectRbac<TypesOf<T>, ScopedGuardName<TypesOf<T>, G>> | null {
  const key = requestKey(context)
  if (key === undefined || !resolved.has(key)) throw new RbacGuardMissingError()
  // The guard stores the subject untyped; `T` only narrows the names it accepts.
  return (resolved.get(key) ?? null) as unknown as SubjectRbac<TypesOf<T>, ScopedGuardName<TypesOf<T>, G>> | null
}
