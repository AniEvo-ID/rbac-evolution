/**
 * Type check of `RbacRegister`, run by `pnpm typecheck` as its own program (`tsc -p test/register`): registering
 * an engine types `request.rbac` in every handler, the guard handlers included.
 */
import { createRbac, MemoryAdapter, type SubjectRbac } from '@anievo-id/rbac-evolution'
import {
  createGuards,
  type GuardHandler,
  type RegisteredRbacTypes,
  rbacPlugin,
  requireRole,
} from '@anievo-id/rbac-evolution-fastify'
import Fastify, { type FastifyRequest } from 'fastify'
import { expectTypeOf } from 'vitest'

type AppRbac = { permissions: 'edit articles' | 'delete articles'; roles: 'admin' | 'editor' }
const rbac = createRbac<AppRbac>({ adapter: new MemoryAdapter() })

declare module '@anievo-id/rbac-evolution-fastify' {
  interface RbacRegister {
    rbac: typeof rbac
  }
}

expectTypeOf<RegisteredRbacTypes>().toEqualTypeOf<AppRbac>()
expectTypeOf<FastifyRequest['rbac']>().toEqualTypeOf<SubjectRbac<AppRbac> | null | undefined>()

export async function routes(): Promise<void> {
  const app = Fastify()
  await app.register(rbacPlugin, { rbac, getSubject: () => null })

  app.get<{ Params: { id: string } }>('/articles/:id', { preHandler: requireRole('admin') }, async (request) => {
    expectTypeOf(request.params.id).toBeString()
    await request.rbac?.can('edit articles')
    // @ts-expect-error -- typo
    await request.rbac?.can('edit artcles')
    // @ts-expect-error -- unknown role
    await request.rbac?.assignRole('ghost')
    return request.rbac?.snapshot()
  })

  // The handlers of the untyped guards get the registered names too (it is the same `FastifyRequest`).
  const onForbidden: GuardHandler = async (request, reply) => {
    // @ts-expect-error -- typo
    await request.rbac?.can('delete artcles')
    return reply.code(403).send()
  }
  createGuards({ onForbidden })
  createGuards<AppRbac>({ onForbidden })
}
