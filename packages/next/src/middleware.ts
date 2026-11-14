import type { Many, Rbac, RbacSnapshot, ScopeOptions, Subject, TeamId } from '@anievo-id/rbac-evolution'
import { matchPath } from './matcher'
import type { PathMatcher } from './matcher'
import { snapshotSatisfies } from './snapshot'
import type { MaybePromise, Requirement } from './types'

export interface RbacMiddlewareRule {
  /** Path pattern(s): `/admin`, `/users/:id`, `/admin/:path*`, or a RegExp. */
  matcher: PathMatcher
  /** Requires the permission (or ANY of them). */
  permission?: Many<string>
  /** Requires the role (or ANY of them). */
  role?: Many<string>
  /** Requires ANY of the given roles or permissions. */
  roleOrPermission?: Many<string>
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
  if (rule.permission !== undefined) out.push({ permission: rule.permission })
  if (rule.role !== undefined) out.push({ role: rule.role })
  if (rule.roleOrPermission !== undefined) out.push({ roleOrPermission: rule.roleOrPermission })
  return out
}

const json = (status: number, error: string, message: string): Response =>
  new Response(JSON.stringify({ error, message }), { status, headers: { 'content-type': 'application/json' } })

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
  async function loadSnapshot(req: Req): Promise<{ snapshot: RbacSnapshot; wildcard: boolean } | null> {
    if (options.rbac === undefined) {
      const snapshot = (await options.getSnapshot(req)) ?? null
      return snapshot && { snapshot, wildcard: options.wildcard ?? false }
    }
    const subject = (await options.getSubject(req)) ?? null
    if (!subject) return null
    const scope: ScopeOptions = {}
    if (options.guard !== undefined) scope.guard = options.guard
    const team = typeof options.team === 'function' ? await options.team(req) : options.team
    if (team !== undefined && team !== null) scope.team = team
    return { snapshot: await options.rbac.for(subject, scope).snapshot(), wildcard: options.rbac.wildcard }
  }

  return async (req: Req): Promise<Response | undefined> => {
    const pathname = req.nextUrl?.pathname ?? new URL(req.url).pathname
    const matching = options.rules.filter((rule) => matchPath(rule.matcher, pathname))
    if (matching.length === 0) return undefined

    const loaded = await loadSnapshot(req)
    if (!loaded) {
      const rule = matching[0]!
      if (options.onUnauthenticated) return options.onUnauthenticated(req, rule)
      if (options.loginUrl !== undefined) {
        const target = typeof options.loginUrl === 'function' ? options.loginUrl(req) : options.loginUrl
        return Response.redirect(new URL(target, req.url), 307)
      }
      return json(401, 'Unauthenticated', 'Unauthenticated.')
    }

    const checkOptions =
      options.rbac === undefined && options.superAdminRoles
        ? { wildcard: loaded.wildcard, superAdminRoles: options.superAdminRoles }
        : { wildcard: loaded.wildcard }

    for (const rule of matching) {
      const passes = ruleRequirements(rule).every((r) => snapshotSatisfies(loaded.snapshot, r, checkOptions))
      if (!passes) {
        if (options.onUnauthorized) return options.onUnauthorized(req, rule)
        return json(403, 'Forbidden', 'User does not have the right roles or permissions.')
      }
    }
    return undefined
  }
}
