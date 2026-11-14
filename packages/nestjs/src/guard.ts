import {
  type RbacRequirement,
  REQUIREMENT_MESSAGES,
  satisfiesRequirement,
  type SubjectRbac,
  UNAUTHENTICATED_MESSAGE,
} from '@anievo-id/rbac-evolution'
import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { getResolved, hasResolved, requestKey, setResolved } from './context'
import type { RbacModuleOptions } from './options'
import { RBAC_MODULE_OPTIONS, RBAC_REQUIREMENTS } from './tokens'

/** Handlers already enforced for a request — the guard may run twice (global + `@UseGuards`). */
const enforced = new WeakMap<object, Set<unknown>>()

/**
 * Only HTTP requests and RPC messages get a fresh key object per call. A WebSocket client or a
 * GraphQL context lives across many calls, so caching or skipping checks by it would let a denied
 * client through on its next message.
 */
const isPerCall = (context: ExecutionContext): boolean => ['http', 'rpc'].includes(context.getType<string>())

/**
 * Resolves the current subject (once per request) and enforces the `@RequirePermissions()`,
 * `@RequireRoles()` and `@RequireRoleOrPermission()` metadata of the class and the handler.
 *
 * - no subject → `UnauthorizedException` `401 { error: 'UNAUTHENTICATED', message }`
 * - missing access → `ForbiddenException` `403 { error: 'FORBIDDEN', reason, message }`
 *
 * Bodies are identical to `@anievo-id/rbac-evolution-express`.
 */
@Injectable()
export class RbacGuard implements CanActivate {
  // Explicit tokens: the package is built with esbuild, which does not emit `design:paramtypes`.
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(RBAC_MODULE_OPTIONS) private readonly options: RbacModuleOptions,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const key = requestKey(context)
    const perCall = isPerCall(context)
    const rbac = await this.resolve(context, key, perCall)

    const handler = context.getHandler()
    if (perCall && key !== undefined && enforced.get(key)?.has(handler)) return true

    const requirements = [
      ...(this.reflector.get<RbacRequirement[] | undefined>(RBAC_REQUIREMENTS, context.getClass()) ?? []),
      ...(this.reflector.get<RbacRequirement[] | undefined>(RBAC_REQUIREMENTS, handler) ?? []),
    ]
    if (requirements.length === 0) return true

    if (rbac === null) {
      throw new UnauthorizedException({ error: 'UNAUTHENTICATED', message: UNAUTHENTICATED_MESSAGE })
    }

    for (const requirement of requirements) {
      if (!(await satisfiesRequirement(rbac, requirement))) {
        throw new ForbiddenException({
          error: 'FORBIDDEN',
          reason: requirement.kind,
          message: REQUIREMENT_MESSAGES[requirement.kind],
          ...(this.options.exposeRequirements && { required: requirement.requirements }),
        })
      }
    }
    // Mark as enforced only once every requirement passed.
    if (perCall && key !== undefined) enforced.set(key, (enforced.get(key) ?? new Set<unknown>()).add(handler))
    return true
  }

  private async resolve(context: ExecutionContext, key: object | undefined, perCall: boolean): Promise<SubjectRbac | null> {
    if (perCall && key !== undefined && hasResolved(key)) return getResolved(key) ?? null

    const { rbac, getSubject, guard, team } = this.options
    const subject = await getSubject(context)
    let result: SubjectRbac | null = null
    if (subject) {
      const teamId = team ? await team(context) : undefined
      result = rbac.for(subject, {
        ...(guard !== undefined && { guard }),
        ...(teamId !== undefined && { team: teamId }),
      })
    }
    if (key !== undefined) setResolved(key, result)
    return result
  }
}
