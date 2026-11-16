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
  type RbacModuleOptions,
  type RbacRequirement,
  type RequirementKind,
  type RequirementNames,
  RequirePermissions,
  RequireRoleOrPermission,
  RequireRoles,
  type RoleRequirementOptions,
} from '../src'

const rbac = createRbac({ adapter: new MemoryAdapter() })
const guest = () => null

/** The decorator type every `@Require*()` / `@Can*()` factory returns (usable on classes and methods). */
type RbacDecorator = ReturnType<typeof applyDecorators>

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
      // @ts-expect-error -- exactOptionalPropertyTypes: `guard` does not accept explicit `undefined`
      RbacModule.forRoot({ rbac, getSubject: guest, guard: undefined })
      // @ts-expect-error -- exactOptionalPropertyTypes: `exposeRequirements` does not accept explicit `undefined`
      RbacModule.forRoot({ rbac, getSubject: guest, exposeRequirements: undefined })
      // @ts-expect-error -- exactOptionalPropertyTypes: `globalGuard` does not accept explicit `undefined`
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
    expectTypeOf(RequirePermissions).parameters.toEqualTypeOf<(RequirementNames | PermissionRequirementOptions)[]>()
    expectTypeOf(RequireRoles).parameters.toEqualTypeOf<(RequirementNames | RoleRequirementOptions)[]>()
    expectTypeOf(RequireRoleOrPermission).parameters.toEqualTypeOf<RequirementNames[]>()
    expectTypeOf(CanAny).parameters.toEqualTypeOf<RequirementNames[]>()
    expectTypeOf(CanAll).parameters.toEqualTypeOf<RequirementNames[]>()
    expectTypeOf<RequirementNames>().toEqualTypeOf<string | readonly string[]>()

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
      // @ts-expect-error -- role-or-permission takes no options
      RequireRoleOrPermission('admin', { any: true })
      // @ts-expect-error -- CanAny takes no options
      CanAny('a', { any: false })
      // @ts-expect-error -- CanAll takes no options
      CanAll('a', {})
      // @ts-expect-error -- arrays of non-strings
      RequireRoles([1, 2])
      // @ts-expect-error -- options are booleans
      RequireRoles('a', { all: 'yes' })
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
