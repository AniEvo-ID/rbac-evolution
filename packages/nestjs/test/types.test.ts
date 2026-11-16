/**
 * Type tests: the public types are part of the API. Enforced by `tsc --noEmit` (`pnpm typecheck`),
 * which includes `test/`; `expectTypeOf` and `@ts-expect-error` lines fail the typecheck when a type drifts.
 * Calls (and decorated classes) that would do real work live in functions that are never invoked.
 */
import 'reflect-metadata'
import { createRbac, MemoryAdapter, type Rbac, type Subject, type SubjectRbac, type TeamId } from '@anievo-id/rbac-evolution'
import {
  applyDecorators,
  type CanActivate,
  Controller,
  type DynamicModule,
  type ExecutionContext,
  Get,
  Module,
} from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { describe, expectTypeOf, it } from 'vitest'
import {
  CanAll,
  CanAny,
  createRbacDecorators,
  CurrentRbac,
  getRbac,
  type PermissionRequirementOptions,
  RBAC,
  RBAC_MODULE_OPTIONS,
  RBAC_REQUIREMENTS,
  RbacGuard,
  RbacGuardMissingError,
  RbacModule,
  type RbacModuleAsyncConfig,
  type RbacModuleConfig,
  type RbacDecorator,
  type RbacDecoratorOptions,
  type RbacDecorators,
  type RbacModuleOptions,
  type RbacRequirement,
  type RequirementKind,
  type RequirementNames,
  RequirePermissions,
  RequireRoleOrPermission,
  RequireRoles,
  type RoleRequirementOptions,
  type RequirePermissionsOptions,
  type RequireRolesOptions,
} from '../src'

const rbac = createRbac({ adapter: new MemoryAdapter() })
const guest = () => null

/** The decorator type every `@Require*()` / `@Can*()` factory returns (usable on classes and methods). */
expectTypeOf<RbacDecorator>().toEqualTypeOf<ReturnType<typeof applyDecorators>>()

describe('nestjs types: RbacModule options', () => {
  it('types RbacModuleOptions', () => {
    expectTypeOf<RbacModuleOptions['rbac']>().toEqualTypeOf<Rbac>()
    expectTypeOf<RbacModuleOptions['getSubject']>().parameters.toEqualTypeOf<[ExecutionContext]>()
    expectTypeOf<RbacModuleOptions['getSubject']>().returns.toEqualTypeOf<
      Subject | null | undefined | Promise<Subject | null | undefined>
    >()
    expectTypeOf<RbacModuleOptions['team']>().toEqualTypeOf<
      ((context: ExecutionContext) => TeamId | undefined | Promise<TeamId | undefined>) | undefined
    >()
    expectTypeOf<RbacModuleOptions>().toHaveProperty('guard').toEqualTypeOf<string | undefined>()
    expectTypeOf<RbacModuleOptions>().toHaveProperty('exposeRequirements').toEqualTypeOf<boolean | undefined>()
    expectTypeOf<RbacModuleConfig>().toMatchTypeOf<RbacModuleOptions>()
    expectTypeOf<RbacModuleConfig>().toHaveProperty('globalGuard').toEqualTypeOf<boolean | undefined>()
  })

  it('forRoot() accepts sync and async getSubject and returns a DynamicModule', () => {
    expectTypeOf(RbacModule.forRoot).parameter(0).toEqualTypeOf<RbacModuleConfig>()
    expectTypeOf(RbacModule.forRoot).returns.toEqualTypeOf<DynamicModule>()

    RbacModule.forRoot({ rbac, getSubject: () => ({ type: 'user', id: 1 }) })
    RbacModule.forRoot({ rbac, getSubject: () => undefined, guard: 'api', exposeRequirements: true, globalGuard: true })
    RbacModule.forRoot({
      rbac,
      getSubject: async (ctx) => {
        expectTypeOf(ctx).toEqualTypeOf<ExecutionContext>()
        const user = ctx.switchToHttp().getRequest<{ user?: { id: string } }>().user
        return user ? { type: 'user', id: user.id } : null
      },
      team: async () => null,
    })
    const typed = createRbac<{ permissions: 'edit articles'; roles: 'writer' }>({ adapter: new MemoryAdapter() })
    RbacModule.forRoot({ rbac: typed, getSubject: guest })
  })

  it('forRoot() rejects invalid options', () => {
    function invalid() {
      // @ts-expect-error -- `rbac` is required
      RbacModule.forRoot({ getSubject: guest })
      // @ts-expect-error -- `getSubject` is required
      RbacModule.forRoot({ rbac })
      // @ts-expect-error -- a subject needs `type` and `id`
      RbacModule.forRoot({ rbac, getSubject: () => ({ id: 1 }) })
      // @ts-expect-error -- `globalGuard` is a boolean
      RbacModule.forRoot({ rbac, getSubject: guest, globalGuard: 'yes' })
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      RbacModule.forRoot({ rbac, getSubject: guest, guard: undefined })
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      RbacModule.forRoot({ rbac, getSubject: guest, exposeRequirements: undefined })
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      RbacModule.forRoot({ rbac, getSubject: guest, globalGuard: undefined })
    }
    expectTypeOf(invalid).toBeFunction()
  })

  it('forRootAsync() takes a factory with injected dependencies', () => {
    class ConfigService {
      get(_key: string): string {
        return 'api'
      }
    }
    @Module({ providers: [ConfigService], exports: [ConfigService] })
    class ConfigModule {}

    expectTypeOf(RbacModule.forRootAsync).parameter(0).toEqualTypeOf<RbacModuleAsyncConfig>()
    expectTypeOf(RbacModule.forRootAsync).returns.toEqualTypeOf<DynamicModule>()
    expectTypeOf<RbacModuleAsyncConfig['useFactory']>().toEqualTypeOf<
      (...args: never[]) => RbacModuleOptions | Promise<RbacModuleOptions>
    >()

    RbacModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({ rbac, getSubject: guest, guard: config.get('guard') }),
      globalGuard: true,
    })
    RbacModule.forRootAsync({ useFactory: async () => ({ rbac, getSubject: guest }) })
    // `inject` is typed as `FactoryProvider['inject']`, which includes `undefined`.
    RbacModule.forRootAsync({ useFactory: () => ({ rbac, getSubject: guest }), inject: undefined })
  })

  it('forRootAsync() rejects invalid config', () => {
    function invalid() {
      // @ts-expect-error -- `useFactory` is required
      RbacModule.forRootAsync({ inject: [] })
      // @ts-expect-error -- the factory must return full options
      RbacModule.forRootAsync({ useFactory: () => ({ rbac }) })
      // @ts-expect-error -- the async factory must resolve to full options
      RbacModule.forRootAsync({ useFactory: async () => ({ getSubject: guest }) })
      // @ts-expect-error -- exactOptionalPropertyTypes: `imports` does not accept explicit `undefined`
      RbacModule.forRootAsync({ useFactory: () => ({ rbac, getSubject: guest }), imports: undefined })
    }
    expectTypeOf(invalid).toBeFunction()
  })
})

describe('nestjs types: decorators', () => {
  it('return class/method decorators', () => {
    expectTypeOf(RequirePermissions).returns.toEqualTypeOf<RbacDecorator>()
    expectTypeOf(RequireRoles).returns.toEqualTypeOf<RbacDecorator>()
    expectTypeOf(RequireRoleOrPermission).returns.toEqualTypeOf<RbacDecorator>()
    expectTypeOf(CanAny).returns.toEqualTypeOf<RbacDecorator>()
    expectTypeOf(CanAll).returns.toEqualTypeOf<RbacDecorator>()
    expectTypeOf(CurrentRbac).toEqualTypeOf<() => ParameterDecorator>()
  })

  it('accept names, pipe strings, arrays and a trailing options object', () => {
    // Generic over the arguments (so names can be checked); the top-level decorators accept any name.
    expectTypeOf(RequirePermissions).toEqualTypeOf<RbacDecorators['RequirePermissions']>()
    expectTypeOf(RequireRoles).toEqualTypeOf<RbacDecorators['RequireRoles']>()
    expectTypeOf(RequireRoleOrPermission).toEqualTypeOf<RbacDecorators['RequireRoleOrPermission']>()
    expectTypeOf(CanAny).toEqualTypeOf<RbacDecorators['CanAny']>()
    expectTypeOf(CanAll).toEqualTypeOf<RbacDecorators['CanAll']>()
    expectTypeOf(createRbacDecorators()).toEqualTypeOf<RbacDecorators>()
    expectTypeOf<RequirementNames>().toEqualTypeOf<string | readonly string[]>()
    // Spread arrays are not checked, so code that builds names at runtime still compiles.
    const spread: (RequirementNames | PermissionRequirementOptions)[] = ['a']
    const roleSpread: (RequirementNames | RoleRequirementOptions)[] = ['a']
    const nameSpread: RequirementNames[] = ['a']
    RequirePermissions(...spread)
    RequireRoles(...roleSpread)
    RequireRoleOrPermission(...nameSpread)
    CanAny(...nameSpread)
    CanAll(...nameSpread)

    function declare() {
      @Controller('articles')
      @RequireRoles('staff')
      class ArticlesController {
        @Get('a')
        @RequirePermissions('edit articles')
        @RequirePermissions('edit articles|delete articles')
        @RequirePermissions('edit articles', 'publish articles')
        @RequirePermissions(['edit articles', 'publish articles'] as const)
        @RequirePermissions('a', 'b', { any: true })
        a() {}

        @Get('b')
        @RequireRoles('admin|editor')
        @RequireRoles(['writer', 'editor'], { all: true })
        @RequireRoleOrPermission('admin|edit articles')
        @RequireRoleOrPermission(['admin', 'edit articles'])
        @CanAny('edit articles', 'publish articles')
        @CanAll(['edit articles', 'publish|review'])
        b(@CurrentRbac() rbac: SubjectRbac | null) {
          return rbac?.snapshot() ?? null
        }
      }
      return ArticlesController
    }
    expectTypeOf(declare).toBeFunction()
  })

  it('rejects wrong arguments', () => {
    function invalid() {
      // @ts-expect-error -- names are strings
      RequirePermissions(1)
      // @ts-expect-error -- `all` is a role option
      RequirePermissions('edit articles', { all: true })
      // @ts-expect-error -- `any` is a permission option
      RequireRoles('admin', { any: true })
      // @ts-expect-error -- role-or-permission takes only `{ guard }`
      RequireRoleOrPermission('admin', { any: true })
      // @ts-expect-error -- CanAny takes only `{ guard }`
      CanAny('a', { any: false })
      // @ts-expect-error -- CanAll takes only `{ guard }`
      CanAll('a', { all: true })
      // @ts-expect-error -- arrays of non-strings
      RequireRoles([1, 2])
      // @ts-expect-error -- options are booleans
      RequireRoles('a', { all: 'yes' })
      // @ts-expect-error -- at least one name is required
      RequirePermissions()
      // @ts-expect-error -- options must be the last argument
      RequirePermissions({ any: true }, 'a')
    }
    expectTypeOf(invalid).toBeFunction()
  })

  it('options accept explicit `undefined` (core types declare `?: boolean | undefined`)', () => {
    expectTypeOf<PermissionRequirementOptions>().toEqualTypeOf<{ any?: boolean | undefined }>()
    expectTypeOf<RoleRequirementOptions>().toEqualTypeOf<{ all?: boolean | undefined }>()
    function valid(flag: boolean | undefined) {
      RequirePermissions('a', { any: flag })
      RequireRoles('a', { all: undefined })
    }
    expectTypeOf(valid).toBeFunction()
  })
})

describe('nestjs types: createRbacDecorators() (typed names)', () => {
  type AppTypes = { permissions: 'edit articles' | 'delete articles'; roles: 'admin' | 'writer' }
  const typed = createRbacDecorators<AppTypes>()

  it('returns typed versions of the requirement decorators', () => {
    expectTypeOf(typed).toEqualTypeOf<RbacDecorators<AppTypes>>()
    expectTypeOf(typed.RequirePermissions).returns.toEqualTypeOf<RbacDecorator>()
    expectTypeOf(typed.CanAll).returns.toEqualTypeOf<RbacDecorator>()

    function declare() {
      const { RequirePermissions, RequireRoles, RequireRoleOrPermission, CanAny, CanAll } = typed
      @Controller('articles')
      @RequireRoles('admin|writer')
      class ArticlesController {
        @Get('a')
        @RequirePermissions('edit articles')
        @RequirePermissions('edit articles|delete articles', ['edit articles'], { any: true })
        @RequireRoles(['admin', 'writer'], { all: true })
        @RequireRoleOrPermission('admin|edit articles')
        @CanAny('edit articles', 'delete articles')
        @CanAll(['edit articles', 'delete articles'])
        a() {}
      }
      return ArticlesController
    }
    expectTypeOf(declare).toBeFunction()
  })

  it('rejects typos, also inside pipe lists and arrays', () => {
    function invalid() {
      // @ts-expect-error -- typo
      typed.RequirePermissions('edit artcles')
      // @ts-expect-error -- typo inside a pipe list
      typed.RequirePermissions('edit articles|delete artcles', { any: true })
      // @ts-expect-error -- typo inside an array
      typed.CanAny(['edit articles', 'nope'])
      // @ts-expect-error -- a permission is not a role
      typed.RequireRoles('edit articles')
      // @ts-expect-error -- neither a role nor a permission
      typed.RequireRoleOrPermission('admin', 'nope')
      // @ts-expect-error -- typo
      typed.CanAll('nope')
      // @ts-expect-error -- no names
      typed.RequireRoles()
    }
    expectTypeOf(invalid).toBeFunction()
  })

  it('the default (untyped) decorators still accept any string', () => {
    const loose = createRbacDecorators()
    function valid() {
      loose.RequirePermissions('anything|else', { any: true })
      RequirePermissions('anything|else', { any: true })
      RequireRoles(['whatever'])
      RequireRoleOrPermission('x')
      // A `string` value is not checked, even with typed names.
      const dynamic: string = 'edit articles'
      typed.RequirePermissions(dynamic)
    }
    expectTypeOf(valid).toBeFunction()
  })
})

describe('nestjs types: guard & context', () => {
  it('RbacGuard is a CanActivate resolving to a boolean', () => {
    expectTypeOf<RbacGuard>().toMatchTypeOf<CanActivate>()
    expectTypeOf<RbacGuard['canActivate']>().parameters.toEqualTypeOf<[ExecutionContext]>()
    expectTypeOf<RbacGuard['canActivate']>().returns.toEqualTypeOf<Promise<boolean>>()
    expectTypeOf(RbacGuard).constructorParameters.toEqualTypeOf<[Reflector, RbacModuleOptions]>()
  })

  it('getRbac() returns the resolved SubjectRbac or null', () => {
    expectTypeOf(getRbac).parameters.toEqualTypeOf<[ExecutionContext]>()
    expectTypeOf(getRbac).returns.toEqualTypeOf<SubjectRbac | null>()
  })

  it('types requirements metadata', () => {
    expectTypeOf<RequirementKind>().toEqualTypeOf<'permission' | 'role' | 'role_or_permission'>()
    expectTypeOf<RbacRequirement>().toEqualTypeOf<{ kind: RequirementKind; requirements: string[][] }>()
  })

  it('exports tokens and errors', () => {
    expectTypeOf(RBAC).toBeSymbol()
    expectTypeOf(RBAC_MODULE_OPTIONS).toBeSymbol()
    expectTypeOf<typeof RBAC_REQUIREMENTS>().toEqualTypeOf<'rbac-evolution:requirements'>()
    expectTypeOf<RbacGuardMissingError>().toMatchTypeOf<Error>()
    expectTypeOf<RbacGuardMissingError['code']>().toEqualTypeOf<'RBAC_GUARD_MISSING'>()
  })
})

describe('nestjs types: per-route guard option', () => {
  type AppTypes = { permissions: 'edit articles' | 'delete articles'; roles: 'admin' | 'writer' }

  it('types the options', () => {
    expectTypeOf<RbacDecoratorOptions>().toEqualTypeOf<{ guard?: string | undefined }>()
    expectTypeOf<RequirePermissionsOptions>().toEqualTypeOf<{ any?: boolean | undefined; guard?: string | undefined }>()
    expectTypeOf<RequireRolesOptions>().toEqualTypeOf<{ all?: boolean | undefined; guard?: string | undefined }>()
  })

  it('every decorator takes a trailing `{ guard: string }`, typed names included; a non-string guard is rejected', () => {
    const typed = createRbacDecorators<AppTypes>()
    function check() {
      RequirePermissions('edit articles', { guard: 'api' })
      RequirePermissions('a', 'b', { any: true, guard: 'api' })
      RequireRoles('admin', { guard: 'api' })
      RequireRoles('admin', 'writer', { all: true, guard: undefined })
      RequireRoleOrPermission('admin|edit articles', { guard: 'api' })
      CanAny('a', 'b', { guard: 'api' })
      CanAll(['a'], { guard: 'api' })
      typed.RequireRoles('admin', { guard: 'api' })
      typed.CanAll('edit articles', { guard: 'api' })
      // @ts-expect-error -- `guard` is a string
      RequireRoles('admin', { guard: 1 })
      // @ts-expect-error -- `guard` is a string
      RequirePermissions('a', { guard: 1 })
      // @ts-expect-error -- `guard` is a string
      CanAny('a', { guard: 1 })
      // @ts-expect-error -- `guard` is a string
      typed.RequireRoleOrPermission('admin', { guard: 1 })
      // @ts-expect-error -- typed names are still checked with options
      typed.RequireRoles('admn', { guard: 'api' })
      // @ts-expect-error -- options must be the last argument
      CanAll({ guard: 'api' }, 'a')
    }
    expectTypeOf(check).toBeFunction()
  })
})
