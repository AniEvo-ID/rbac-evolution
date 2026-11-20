import type { Rbac, RbacSnapshot, Subject } from '@anievo-id/rbac-evolution'
import type { BetterAuthPlugin } from 'better-auth'
import { createAuthEndpoint, sessionMiddleware } from 'better-auth/api'

export interface RbacPluginOptions {
  /** The engine from `createRbac()`. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rbac: Rbac<any>
  /** The subject type of a Better Auth user. Default: `'user'`. */
  subjectType?: string | undefined
  /** The guard of the snapshot and of `defaultRoles`. Default: the engine's `defaultGuard`. */
  guard?: string | undefined
  /** Roles every new user gets when Better Auth creates them (sign-up, first social sign-in, admin). */
  defaultRoles?: readonly string[] | undefined
  /**
   * Remove the user's roles and direct permissions, in every team, after Better Auth deletes the user.
   * Default: `true`.
   */
  revokeOnDelete?: boolean | undefined
}

/** The rbac subject of a Better Auth user id. */
export const userSubject = (userId: string, subjectType = 'user'): Subject => ({ type: subjectType, id: userId })

/**
 * Better Auth plugin: `GET /rbac/snapshot` for the signed-in user (`authClient.rbac.snapshot()` with `rbacClient()`),
 * `defaultRoles` on user creation, and cleanup when a user is deleted. The rbac data stays in the rbac tables; no
 * Better Auth schema changes.
 *
 * ```ts
 * export const auth = betterAuth({ ..., plugins: [rbacPlugin({ rbac, defaultRoles: ['member'] })] })
 * ```
 */
export const rbacPlugin = (options: RbacPluginOptions) => {
  const { rbac, subjectType = 'user', guard, defaultRoles = [], revokeOnDelete = true } = options
  const scoped = (userId: string) => rbac.for(userSubject(userId, subjectType), guard === undefined ? {} : { guard })

  return {
    id: 'rbac',
    endpoints: {
      getRbacSnapshot: createAuthEndpoint(
        '/rbac/snapshot',
        { method: 'GET', use: [sessionMiddleware] },
        async (ctx): Promise<RbacSnapshot> => ctx.json(await scoped(ctx.context.session.user.id).snapshot()),
      ),
    },
    init: () => ({
      options: {
        databaseHooks: {
          user: {
            create: {
              after: async (user: { id: string }) => {
                if (defaultRoles.length > 0) await scoped(user.id).assignRole([...defaultRoles])
              },
            },
            delete: {
              after: async (user: { id: string }) => {
                if (revokeOnDelete) await scoped(user.id).revokeAll({ allTeams: true })
              },
            },
          },
        },
      },
    }),
  } satisfies BetterAuthPlugin
}

/** What `subjectFromSession` needs: `auth.api.getSession`. */
export interface SessionSource {
  api: { getSession(context: { headers: Headers }): Promise<{ user: { id: string } } | null> }
}

/**
 * The rbac subject of a request's Better Auth session, or `null` for a guest. Use it as the `getSubject` of any
 * integration:
 *
 * ```ts
 * createRbacServer({ rbac, getSubject: (request) => subjectFromSession(auth, request.headers) })
 * ```
 */
export async function subjectFromSession(
  auth: SessionSource,
  headers: Headers,
  subjectType = 'user',
): Promise<Subject | null> {
  const session = await auth.api.getSession({ headers })
  return session ? userSubject(session.user.id, subjectType) : null
}
