import type { Rbac, Subject, SubjectRbac, TeamId } from '@anievo-id/rbac-evolution'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'

type MaybePromise<T> = T | Promise<T>

/** Request hook in which `request.rbac` is resolved. */
export type RbacHook = 'onRequest' | 'preValidation' | 'preHandler'

export interface RbacPluginOptions {
  /** The RBAC engine created with `createRbac(...)`. */
  rbac: Rbac
  /**
   * Resolves the authenticated subject for this request (e.g. from `request.user` or a session).
   * Return `null` / `undefined` for guests.
   */
  getSubject: (request: FastifyRequest) => MaybePromise<Subject | null | undefined>
  /** Guard name (e.g. `web` or `api`). Defaults to the engine's `defaultGuard`. */
  guard?: string | undefined
  /** Resolves the current team (only when the engine was created with `teams: true`). */
  team?: (request: FastifyRequest) => MaybePromise<TeamId | undefined>
  /**
   * Hook in which the subject is resolved. It must run after your authentication.
   * Default: `'preHandler'` (runs before route-level `preHandler` guards).
   */
  hook?: RbacHook | undefined
}

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Roles & permissions of the current subject, set by the rbac-evolution plugin.
     * `null` for guests, `undefined` when the plugin did not run for this request.
     */
    rbac?: SubjectRbac | null | undefined
  }
}

const plugin: FastifyPluginAsync<RbacPluginOptions> = async (fastify, options) => {
  const { rbac, getSubject, guard, team, hook = 'preHandler' } = options

  if (!fastify.hasRequestDecorator('rbac')) {
    fastify.decorateRequest('rbac', undefined)
  }

  fastify.addHook(hook, async (request: FastifyRequest) => {
    const subject = await getSubject(request)
    if (!subject) {
      request.rbac = null
      return
    }
    const teamId = team ? await team(request) : undefined
    request.rbac = rbac.for(subject, {
      ...(guard !== undefined && { guard }),
      ...(teamId !== undefined && { team: teamId }),
    })
  })
}

/**
 * Fastify plugin that resolves the current subject and sets `request.rbac`
 * (a `SubjectRbac`, or `null` for guests).
 *
 * Wrapped with `fastify-plugin`, so the hook applies to the context it is registered in
 * (register it inside an encapsulated plugin to scope it, e.g. per guard or per team).
 *
 * ```ts
 * await app.register(rbacPlugin, { rbac, getSubject: (req) => (req.user ? { type: 'user', id: req.user.id } : null) })
 * ```
 */
export const rbacPlugin = fp(plugin, {
  name: '@anievo-id/rbac-evolution-fastify',
  fastify: '>=5',
})
