import type {
  DefaultGuardName,
  DefaultRbacTypes,
  Rbac,
  RbacTypeConfig,
  ScopedGuardName,
  Subject,
  SubjectRbac,
  TeamId,
} from '@anievo-id/rbac-evolution'
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import fp from 'fastify-plugin'

type MaybePromise<T> = T | Promise<T>

/** The type configuration of `T`: `T` itself, or the `X` of an `Rbac<X>` engine. */
export type TypesOf<T> = T extends Rbac<infer X> ? X : T extends RbacTypeConfig ? T : never

/**
 * Register your engine here to type `request.rbac` in every handler of the app:
 *
 * ```ts
 * declare module '@anievo-id/rbac-evolution-fastify' {
 *   interface RbacRegister {
 *     rbac: typeof rbac // or the names type: AppRbac
 *   }
 * }
 * ```
 *
 * `FastifyRequest` is typed by module augmentation, which is global, so the engine passed to `rbacPlugin`
 * can't flow there on its own. Without a registration, `request.rbac` is an untyped `SubjectRbac`.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type
export interface RbacRegister {}

/** The type configuration registered in {@link RbacRegister}, or `DefaultRbacTypes` (any name) without one. */
export type RegisteredRbacTypes = RbacRegister extends { rbac: infer R } ? TypesOf<R> : DefaultRbacTypes

/**
 * A Fastify request whose `rbac` has the names of `T` (a names type like `AppRbac`, or `typeof rbac`).
 * With per-guard names, `G` is the guard of the request (the default guard's names by default):
 * `RbacRequest<typeof rbac, FastifyRequest, 'api'>` on the routes of an `api` middleware.
 * For typing a handler without a global {@link RbacRegister}, e.g. when two plugins use different engines:
 *
 * ```ts
 * app.get('/articles', async (request: RbacRequest<typeof rbac>) => { ... })
 * ```
 */
export type RbacRequest<
  T extends RbacTypeConfig | Rbac<RbacTypeConfig> = DefaultRbacTypes,
  Req = FastifyRequest,
  G extends string = DefaultGuardName<TypesOf<T>>,
> = Omit<Req, 'rbac'> & {
  /**
   * Roles & permissions of the current subject, set by the rbac-evolution plugin.
   * `null` for guests, `undefined` when the plugin did not run for this request.
   */
  rbac?: SubjectRbac<TypesOf<T>, ScopedGuardName<TypesOf<T>, G>> | null | undefined
}

/** Request hook in which `request.rbac` is resolved. */
export type RbacHook = 'onRequest' | 'preValidation' | 'preHandler'

export interface RbacPluginOptions<T extends RbacTypeConfig = DefaultRbacTypes> {
  /** The RBAC engine created with `createRbac(...)`. */
  rbac: Rbac<T>
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
     * Typed with the names of the engine registered in `RbacRegister` (any name without one).
     */
    rbac?: SubjectRbac<RegisteredRbacTypes> | null | undefined
  }
}

const plugin: FastifyPluginAsync<RbacPluginOptions> = async (fastify, options) => {
  const { getSubject, guard, team, hook = 'preHandler' } = options
  // The request's subject is typed by `RbacRegister`, not by the options: store it untyped.
  const rbac = options.rbac as unknown as Rbac

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
 *
 * To type `request.rbac` with the names of a typed engine, register it in {@link RbacRegister}
 * (or type a handler's `request` as {@link RbacRequest}).
 */
export const rbacPlugin: FastifyPluginAsync<RbacPluginOptions> = fp(plugin, {
  name: '@anievo-id/rbac-evolution-fastify',
  fastify: '>=5',
})
