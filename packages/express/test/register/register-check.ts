/**
 * Type check of `RbacRegister`, run by `pnpm typecheck` as its own program (`tsc -p test/register`): registering
 * an engine types `req.rbac` in every handler, the guard handlers included.
 */
import { createRbac, MemoryAdapter, type SubjectRbac } from '@anievo-id/rbac-evolution'
import {
  asyncHandler,
  createGuards,
  type GuardHandler,
  type RegisteredRbacTypes,
  rbacMiddleware,
  requireRole,
} from '@anievo-id/rbac-evolution-express'
import express, { type Request } from 'express'
import { expectTypeOf } from 'vitest'

type AppRbac = { permissions: 'edit articles' | 'delete articles'; roles: 'admin' | 'editor' }
const rbac = createRbac<AppRbac>({ adapter: new MemoryAdapter() })

declare module '@anievo-id/rbac-evolution-express' {
  interface RbacRegister {
    rbac: typeof rbac
  }
}

expectTypeOf<RegisteredRbacTypes>().toEqualTypeOf<AppRbac>()
expectTypeOf<Request['rbac']>().toEqualTypeOf<SubjectRbac<AppRbac> | null | undefined>()

export function routes(): void {
  const app = express()
  app.use(rbacMiddleware({ rbac, getSubject: () => null }))

  app.get('/articles/:id', requireRole('admin'), async (req, res) => {
    await req.rbac?.can('edit articles')
    // @ts-expect-error -- typo
    await req.rbac?.can('edit artcles')
    // @ts-expect-error -- unknown role
    await req.rbac?.assignRole('ghost')
    res.json(await req.rbac?.snapshot())
  })

  app.post(
    '/articles',
    asyncHandler(async (req) => {
      // @ts-expect-error -- typo
      await req.rbac?.hasRole('edtor')
    }),
  )

  // The handlers of the untyped guards get the registered names too (it is the same global `Request`).
  const onForbidden: GuardHandler = async (req, res) => {
    // @ts-expect-error -- typo
    await req.rbac?.can('delete artcles')
    res.sendStatus(403)
  }
  createGuards({ onForbidden })
  createGuards<AppRbac>({ onForbidden })
  void app
}
