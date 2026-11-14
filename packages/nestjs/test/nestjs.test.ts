import 'reflect-metadata'
import { createRbac, MemoryAdapter, type Rbac, type SubjectRbac } from '@anievo-id/rbac-evolution'
import { Controller, type ExecutionContext, Get, Inject, Injectable, type INestApplication, Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  CurrentRbac,
  RBAC,
  RbacModule,
  type RbacModuleOptions,
  RequirePermissions,
  RequireRoleOrPermission,
  RequireRoles,
} from '../src'

const getSubject = (ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>()
  const id = req.headers['x-user']
  return id ? { type: 'user', id: Number(id) } : null
}

async function seed(rbac: Rbac): Promise<void> {
  for (const p of ['edit articles', 'delete articles', 'publish articles']) await rbac.createPermission(p)
  await rbac.createRole('writer')
  await rbac.createRole('editor')
  await rbac.createRole('admin')
  await rbac.role('writer').givePermissionTo('edit articles')
  await rbac.role('editor').givePermissionTo('edit articles', 'publish articles')
  await rbac.for({ type: 'user', id: 1 }).assignRole('writer') // writer
  await rbac.for({ type: 'user', id: 2 }).assignRole('writer', 'editor') // writer + editor
  await rbac.for({ type: 'user', id: 3 }).assignRole('admin')
  await rbac.for({ type: 'user', id: 3 }).givePermissionTo('delete articles')
}

@Controller()
class ArticlesController {
  @Get('edit')
  @RequirePermissions('edit articles')
  edit() {
    return { ok: true }
  }

  @Get('edit-and-publish')
  @RequirePermissions('edit articles', 'publish articles')
  editAndPublish() {
    return { ok: true }
  }

  @Get('publish-or-delete')
  @RequirePermissions('publish articles|delete articles')
  publishOrDelete() {
    return { ok: true }
  }

  @Get('any-flag')
  @RequirePermissions('publish articles', 'delete articles', { any: true })
  anyFlag() {
    return { ok: true }
  }

  @Get('stacked')
  @RequirePermissions('edit articles')
  @RequireRoles('editor')
  stacked() {
    return { ok: true }
  }

  @Get('staff')
  @RequireRoles('admin|editor')
  staff() {
    return { ok: true }
  }

  @Get('writer-and-editor')
  @RequireRoles('writer', 'editor', { all: true })
  writerAndEditor() {
    return { ok: true }
  }

  @Get('admin-or-publish')
  @RequireRoleOrPermission('admin|publish articles')
  adminOrPublish() {
    return { ok: true }
  }

  @Get('me')
  @RequireRoleOrPermission('admin|edit articles')
  async me(@CurrentRbac() rbac: SubjectRbac | null) {
    return rbac ? rbac.snapshot() : null
  }

  @Get('unguarded')
  unguarded(@CurrentRbac() rbac: SubjectRbac | null) {
    return { rbac }
  }
}

@Controller('admin')
@RequireRoles('admin')
class AdminController {
  @Get()
  index() {
    return { ok: true }
  }

  @Get('delete')
  @RequirePermissions('delete articles')
  delete() {
    return { ok: true }
  }
}

@Injectable()
class EngineHolder {
  constructor(@Inject(RBAC) readonly rbac: Rbac) {}
}

@Controller()
class OpenController {
  constructor(@Inject(EngineHolder) private readonly holder: EngineHolder) {}

  @Get('whoami')
  async whoami(@CurrentRbac() rbac: SubjectRbac | null) {
    return { guest: rbac === null, engine: this.holder.rbac instanceof Object }
  }
}

async function start(moduleClass: new () => unknown): Promise<{ app: INestApplication; url: string }> {
  const ref = await Test.createTestingModule({ imports: [moduleClass] }).compile()
  const app = ref.createNestApplication({ logger: false })
  await app.listen(0, '127.0.0.1')
  return { app, url: await app.getUrl() }
}

async function get(url: string, path: string, user?: number) {
  const res = await fetch(url + path, { headers: user === undefined ? {} : { 'x-user': String(user) } })
  return { status: res.status, body: (await res.json()) as unknown }
}

const FORBIDDEN_PERMISSION = { error: 'FORBIDDEN', reason: 'permission', message: 'User does not have the right permissions.' }
const FORBIDDEN_ROLE = { error: 'FORBIDDEN', reason: 'role', message: 'User does not have the right roles.' }
const UNAUTHENTICATED = { error: 'UNAUTHENTICATED', message: 'User is not logged in.' }

describe('rbac-evolution-nestjs: RbacModule.forRoot', () => {
  let app: INestApplication
  let url: string

  beforeAll(async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter() })
    await seed(rbac)

    @Module({ imports: [RbacModule.forRoot({ rbac, getSubject })], controllers: [ArticlesController, AdminController] })
    class AppModule {}

    ;({ app, url } = await start(AppModule))
  })

  afterAll(async () => {
    await app.close()
  })

  it('returns 401 with the Express body for guests', async () => {
    expect(await get(url, '/edit')).toEqual({ status: 401, body: UNAUTHENTICATED })
  })

  it('checks a single permission', async () => {
    expect(await get(url, '/edit', 1)).toEqual({ status: 200, body: { ok: true } })
    expect(await get(url, '/edit', 3)).toEqual({ status: 403, body: FORBIDDEN_PERMISSION })
  })

  it('requires every argument, pipes mean any', async () => {
    expect((await get(url, '/edit-and-publish', 1)).status).toBe(403)
    expect((await get(url, '/edit-and-publish', 2)).status).toBe(200)
    expect((await get(url, '/publish-or-delete', 1)).status).toBe(403)
    expect((await get(url, '/publish-or-delete', 2)).status).toBe(200)
    expect((await get(url, '/publish-or-delete', 3)).status).toBe(200)
  })

  it('supports { any: true }', async () => {
    expect((await get(url, '/any-flag', 1)).status).toBe(403)
    expect((await get(url, '/any-flag', 3)).status).toBe(200)
  })

  it('applies stacked decorators', async () => {
    expect(await get(url, '/stacked', 1)).toEqual({ status: 403, body: FORBIDDEN_ROLE })
    expect((await get(url, '/stacked', 2)).status).toBe(200)
  })

  it('checks roles (any by default, { all: true })', async () => {
    expect((await get(url, '/staff', 1)).status).toBe(403)
    expect((await get(url, '/staff', 2)).status).toBe(200)
    expect((await get(url, '/staff', 3)).status).toBe(200)
    expect((await get(url, '/writer-and-editor', 1)).status).toBe(403)
    expect((await get(url, '/writer-and-editor', 2)).status).toBe(200)
  })

  it('checks role or permission', async () => {
    expect(await get(url, '/admin-or-publish', 1)).toEqual({
      status: 403,
      body: {
        error: 'FORBIDDEN',
        reason: 'role_or_permission',
        message: 'User does not have any of the necessary access rights.',
      },
    })
    expect((await get(url, '/admin-or-publish', 2)).status).toBe(200)
    expect((await get(url, '/admin-or-publish', 3)).status).toBe(200)
  })

  it('injects the SubjectRbac with @CurrentRbac()', async () => {
    expect(await get(url, '/me', 1)).toEqual({
      status: 200,
      body: { roles: ['writer'], permissions: ['edit articles'] },
    })
  })

  it('combines controller-level and handler-level requirements', async () => {
    expect((await get(url, '/admin', 1)).status).toBe(403)
    expect((await get(url, '/admin', 3)).status).toBe(200)
    expect((await get(url, '/admin/delete', 3)).status).toBe(200)
    expect((await get(url, '/admin/delete')).status).toBe(401)
  })

  it('fails loudly when @CurrentRbac() is used without the guard', async () => {
    expect((await get(url, '/unguarded', 1)).status).toBe(500)
  })
})

describe('rbac-evolution-nestjs: forRootAsync + globalGuard', () => {
  let app: INestApplication
  let url: string

  beforeAll(async () => {
    const rbac = createRbac({ adapter: new MemoryAdapter() })
    await seed(rbac)

    const CONFIG = Symbol('config')

    @Module({ providers: [{ provide: CONFIG, useValue: { expose: true } }], exports: [CONFIG] })
    class ConfigModule {}

    @Module({
      imports: [
        RbacModule.forRootAsync({
          imports: [ConfigModule],
          inject: [CONFIG],
          useFactory: async (config: { expose: boolean }): Promise<RbacModuleOptions> => ({
            rbac,
            getSubject,
            exposeRequirements: config.expose,
          }),
          globalGuard: true,
        }),
      ],
      controllers: [ArticlesController, OpenController],
      providers: [EngineHolder],
    })
    class AppModule {}

    ;({ app, url } = await start(AppModule))
  })

  afterAll(async () => {
    await app.close()
  })

  it('resolves the subject on every route with the global guard', async () => {
    expect(await get(url, '/whoami')).toEqual({ status: 200, body: { guest: true, engine: true } })
    expect(await get(url, '/whoami', 1)).toEqual({ status: 200, body: { guest: false, engine: true } })
    expect((await get(url, '/unguarded')).status).toBe(200)
  })

  it('still enforces requirements and exposes them when configured', async () => {
    expect(await get(url, '/edit-and-publish', 1)).toEqual({
      status: 403,
      body: { ...FORBIDDEN_PERMISSION, required: [['edit articles'], ['publish articles']] },
    })
    expect((await get(url, '/edit-and-publish', 2)).status).toBe(200)
  })
})

describe('decorator validation', () => {
  it('throws when no name is given', () => {
    expect(() => RequirePermissions()).toThrow(TypeError)
    expect(() => RequireRoles(' | ')).toThrow(TypeError)
  })
})
