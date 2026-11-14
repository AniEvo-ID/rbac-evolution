import type { SubjectRbac } from '@anievo-id/rbac-evolution'
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
import { MESSAGES, type RbacRequirement, satisfies, UNAUTHENTICATED_MESSAGE } from './requirements'
import { RBAC_MODULE_OPTIONS, RBAC_REQUIREMENTS } from './tokens'

/** Handlers already enforced for a request — the guard may run twice (global + `@UseGuards`). */
const enforced = new WeakMap<object, Set<unknown>>()

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
    const rbac = await this.resolve(context, key)

    const handler = context.getHandler()
    if (key !== undefined) {
      const done = enforced.get(key) ?? new Set<unknown>()
      if (done.has(handler)) return true
      enforced.set(key, done.add(handler))
    }

    const requirements = [
      ...(this.reflector.get<RbacRequirement[] | undefined>(RBAC_REQUIREMENTS, context.getClass()) ?? []),
      ...(this.reflector.get<RbacRequirement[] | undefined>(RBAC_REQUIREMENTS, handler) ?? []),
    ]
    if (requirements.length === 0) return true

    if (rbac === null) {
      throw new UnauthorizedException({ error: 'UNAUTHENTICATED', message: UNAUTHENTICATED_MESSAGE })
    }

    for (const requirement of requirements) {
      if (!(await satisfies(rbac, requirement))) {
        throw new ForbiddenException({
          error: 'FORBIDDEN',
          reason: requirement.kind,
          message: MESSAGES[requirement.kind],
          ...(this.options.exposeRequirements && { required: requirement.requirements }),
        })
      }
    }
    return true
  }

  private async resolve(context: ExecutionContext, key: object | undefined): Promise<SubjectRbac | null> {
    if (key !== undefined && hasResolved(key)) return getResolved(key) ?? null

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
