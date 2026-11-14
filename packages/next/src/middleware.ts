import type { Many, Rbac, RbacSnapshot, ScopeOptions, Subject, TeamId } from '@anievo-id/rbac-evolution'
import { matchPath } from './matcher'
import type { PathMatcher } from './matcher'
import { forbiddenResponse, unauthenticatedResponse } from './responses'
import { snapshotSatisfies, type SnapshotCheckOptions } from './snapshot'
import { checkRequirement, type MaybePromise, type Requirement } from './types'

export interface RbacMiddlewareRule {
  /** Path pattern(s): `/admin`, `/users/:id`, `/admin/:path*`, or a RegExp. */
  matcher: PathMatcher
  /** Requires the permission (or ANY of them). */
  permission?: Many<string>
  /** Requires the role (or ANY of them). */
  role?: Many<string>
  /** Requires ANY of the given roles or permissions. */
  roleOrPermission?: Many<string>
  /** Require EVERY listed permission / role instead of any (spatie v8.5 `canAll()`). */
  all?: boolean
  // A rule with none of the above only requires an authenticated user.
}

/** The request as seen by middleware. `NextRequest` fits; `nextUrl.pathname` is preferred (it excludes `basePath`). */
export type MiddlewareRequest = Request & { nextUrl?: { pathname: string } }

interface BaseOptions<Req extends MiddlewareRequest> {
  /** Every matching rule must pass. Requests matching no rule pass through. */
  rules: readonly RbacMiddlewareRule[]
  /** Redirect guests here (relative to the request URL). Without it, guests get a `401` JSON response. */
  loginUrl?: string | ((req: Req) => string | URL)
  /** Custom response for guests. */
  onUnauthenticated?: (req: Req, rule: RbacMiddlewareRule) => MaybePromise<Response>
  /** Custom response for users missing a role/permission. Default: `403` JSON response. */
  onUnauthorized?: (req: Req, rule: RbacMiddlewareRule) => MaybePromise<Response>
}

/** Loads roles & permissions through an `Rbac` instance (DB adapters need the Node.js middleware runtime). */
export interface RbacMiddlewareWithRbac<Req extends MiddlewareRequest> extends BaseOptions<Req> {
  rbac: Rbac
  getSubject: (req: Req) => MaybePromise<Subject | null | undefined>
  guard?: string
  team?: TeamId | ((req: Req) => MaybePromise<TeamId | undefined>)
  getSnapshot?: never
}

/** Reads roles & permissions from somewhere cheap, e.g. the session/JWT. Works in the Edge runtime. */
export interface RbacMiddlewareWithSnapshot<Req extends MiddlewareRequest> extends BaseOptions<Req> {
  /** Return `null` for guests. */
  getSnapshot: (req: Req) => MaybePromise<RbacSnapshot | null | undefined>
  /** Must match the server's `wildcard` setting. Default: `false`. */
  wildcard?: boolean
  /** Roles that pass every permission check. */
  superAdminRoles?: readonly string[]
  rbac?: never
  getSubject?: never
}

export type RbacMiddlewareOptions<Req extends MiddlewareRequest = MiddlewareRequest> =
  | RbacMiddlewareWithRbac<Req>
  | RbacMiddlewareWithSnapshot<Req>

function ruleRequirements(rule: RbacMiddlewareRule): Requirement[] {
  const out: Requirement[] = []
  if (rule.permission !== undefined) out.push({ permission: rule.permission, ...(rule.all && { all: true }) })
  if (rule.role !== undefined) out.push({ role: rule.role, ...(rule.all && { all: true }) })
  if (rule.roleOrPermission !== undefined) out.push({ roleOrPermission: rule.roleOrPermission })
  return out
}

/**
 * Route protection for `middleware.ts`, like spatie's route middleware.
 * Returns a `Response` when access is denied, or `undefined` to let the request through.
 *
 * ```ts
 * export default createRbacMiddleware({
 *   rules: [{ matcher: '/admin/:path*', role: 'admin' }],
 *   getSnapshot: async (req) => (await getToken({ req }))?.rbac ?? null,
 * })
 * ```
 */
export function createRbacMiddleware<Req extends MiddlewareRequest = MiddlewareRequest>(
  options: RbacMiddlewareOptions<Req>,
): (req: Req) => Promise<Response | undefined> {
  type Checker = (requirement: Requirement) => Promise<boolean>

  /**
   * Resolves who is asking and returns a requirement checker, or `null` for guests.
   * In `rbac` mode the checks go through the engine (`canAny` / `hasAnyRole`), so
   * `superAdminRoles` and the `before` hook apply exactly like in the server helpers.
   */
  async function loadChecker(req: Req): Promise<Checker | null> {
    if (options.rbac === undefined) {
      const snapshot = (await options.getSnapshot(req)) ?? null
      if (!snapshot) return null
      const checkOptions: SnapshotCheckOptions = { wildcard: options.wildcard ?? false }
      if (options.superAdminRoles) checkOptions.superAdminRoles = options.superAdminRoles
      return async (requirement) => snapshotSatisfies(snapshot, requirement, checkOptions)
    }
    const subject = (await options.getSubject(req)) ?? null
    if (!subject) return null
    const scope: ScopeOptions = {}
    if (options.guard !== undefined) scope.guard = options.guard
    const team = typeof options.team === 'function' ? await options.team(req) : options.team
    if (team !== undefined && team !== null) scope.team = team
    const s = options.rbac.for(subject, scope)
    return (requirement) => checkRequirement(requirement, (n) => s.can(n), (n) => s.hasRole(n))
  }

  return async (req: Req): Promise<Response | undefined> => {
    const pathname = req.nextUrl?.pathname ?? new URL(req.url).pathname
    const matching = options.rules.filter((rule) => matchPath(rule.matcher, pathname))
    if (matching.length === 0) return undefined

    const check = await loadChecker(req)
    if (!check) {
      const rule = matching[0]!
      if (options.onUnauthenticated) return options.onUnauthenticated(req, rule)
      if (options.loginUrl !== undefined) {
        const target = typeof options.loginUrl === 'function' ? options.loginUrl(req) : options.loginUrl
        return Response.redirect(new URL(target, req.url), 307)
      }
      return unauthenticatedResponse()
    }

    for (const rule of matching) {
      let failed: Requirement | undefined
      for (const requirement of ruleRequirements(rule)) {
        if (!(await check(requirement))) {
          failed = requirement
          break
        }
      }
      if (failed) {
        if (options.onUnauthorized) return options.onUnauthorized(req, rule)
        return forbiddenResponse(failed)
      }
    }
    return undefined
  }
}
