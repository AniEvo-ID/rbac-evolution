// Type tests: the public types are part of the API. `pnpm typecheck` (tsc) enforces the
// `expectTypeOf` assertions and every `@ts-expect-error` below; vitest only runs the shells.
// JSX / hook calls that only need type-checking live in functions that are never invoked.
import type { ComponentProps, ReactNode } from 'react'
import { describe, expectTypeOf, it } from 'vitest'
import type { RbacSnapshot } from '@anievo-id/rbac-evolution'
import {
  Can,
  Cannot,
  createRbacChecker,
  HasRole,
  RbacProvider,
  useCan,
  useCanAll,
  useCanAny,
  useCannot,
  useHasAllRoles,
  useHasAnyRole,
  useHasRole,
  useRbac,
} from '../src'
import type {
  CannotProps,
  CanProps,
  HasRoleProps,
  PermissionCondition,
  RbacChecker,
  RbacCheckerOptions,
  RbacProviderProps,
  RoleCondition,
} from '../src'

const snapshot: RbacSnapshot = { roles: ['writer'], permissions: ['articles.edit'] }

describe('RbacProvider props', () => {
  it('snapshot is required (null / undefined = guest); the rest are optional', () => {
    expectTypeOf<ComponentProps<typeof RbacProvider>>().toEqualTypeOf<RbacProviderProps>()
    expectTypeOf<RbacProviderProps['snapshot']>().toEqualTypeOf<RbacSnapshot | null | undefined>()
    expectTypeOf<RbacProviderProps['superAdminRoles']>().toEqualTypeOf<readonly string[] | undefined>()
    expectTypeOf<RbacProviderProps['children']>().toEqualTypeOf<ReactNode>()

    void function neverCalled() {
      void (<RbacProvider snapshot={snapshot}>x</RbacProvider>)
      void (<RbacProvider snapshot={null} />)
      void (<RbacProvider snapshot={undefined} />)
      void (
        <RbacProvider snapshot={snapshot} wildcard superAdminRoles={['admin'] as const} loading={false}>
          x
        </RbacProvider>
      )
      // @ts-expect-error -- snapshot must be passed explicitly (pass `null` for guests)
      void (<RbacProvider>x</RbacProvider>)
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      void (<RbacProvider snapshot={null} superAdminRoles={undefined} />)
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      void (<RbacProvider snapshot={null} wildcard={undefined} />)
      // @ts-expect-error -- superAdminRoles is a list
      void (<RbacProvider snapshot={null} superAdminRoles="admin" />)
      // @ts-expect-error -- the snapshot needs both lists
      void (<RbacProvider snapshot={{ roles: [] }} />)
    }
  })
})

describe('hooks', () => {
  it('useRbac() returns the synchronous checker', () => {
    expectTypeOf(useRbac).parameters.toEqualTypeOf<[]>()
    expectTypeOf(useRbac).returns.toEqualTypeOf<RbacChecker>()
    expectTypeOf<RbacChecker['roles']>().toEqualTypeOf<readonly string[]>()
    expectTypeOf<RbacChecker['isSuperAdmin']>().toEqualTypeOf<boolean>()
    expectTypeOf<RbacChecker['loading']>().toEqualTypeOf<boolean>()
  })

  it('checks return plain booleans; single-name vs variadic Many<string> parameters', () => {
    for (const hook of [useCan, useCannot, useCanAny, useCanAll, useHasRole, useHasAnyRole, useHasAllRoles]) {
      expectTypeOf(hook).returns.toEqualTypeOf<boolean>()
    }
    expectTypeOf(useCan).parameters.toEqualTypeOf<[permission: string]>()
    expectTypeOf(useCannot).parameters.toEqualTypeOf<[permission: string]>()
    expectTypeOf(useHasRole).parameters.toEqualTypeOf<[role: string | readonly string[]]>()
    expectTypeOf(useCanAny).parameters.toEqualTypeOf<(string | readonly string[])[]>()
    expectTypeOf(useCanAll).parameters.toEqualTypeOf<(string | readonly string[])[]>()
    expectTypeOf(useHasAnyRole).parameters.toEqualTypeOf<(string | readonly string[])[]>()
    expectTypeOf(useHasAllRoles).parameters.toEqualTypeOf<(string | readonly string[])[]>()

    void function neverCalled() {
      useCanAny('a', 'b')
      useCanAny(['a', 'b'] as const, 'c')
      useHasRole(['writer', 'editor'])
      // @ts-expect-error -- useCan checks ONE permission; use useCanAll / useCanAny for lists
      useCan(['a', 'b'])
      // @ts-expect-error -- names are strings
      useCan(1)
      // @ts-expect-error -- useHasRole takes one name or one list, not varargs
      useHasRole('a', 'b')
    }
  })
})

describe('<Can> / <Cannot> / <HasRole> props', () => {
  it('exactly one condition, plus optional children and fallback', () => {
    expectTypeOf<ComponentProps<typeof Can>>().toEqualTypeOf<CanProps>()
    expectTypeOf<ComponentProps<typeof Cannot>>().toEqualTypeOf<CannotProps>()
    expectTypeOf<ComponentProps<typeof HasRole>>().toEqualTypeOf<HasRoleProps>()
    expectTypeOf<CanProps>().toMatchTypeOf<PermissionCondition>()
    expectTypeOf<HasRoleProps>().toMatchTypeOf<RoleCondition>()
    expectTypeOf<CanProps['fallback']>().toEqualTypeOf<ReactNode>()

    void function neverCalled() {
      void (<Can permission="articles.edit">x</Can>)
      void (<Can anyOf={['a', 'b'] as const} fallback={<span>no</span>} />)
      void (<Can allOf={['a', 'b']}>x</Can>)
      void (<Cannot permission="a">x</Cannot>)
      void (<HasRole role="writer">x</HasRole>)
      void (<HasRole anyOf={['writer', 'editor']}>x</HasRole>)
      void (<HasRole allOf={['writer', 'editor']}>x</HasRole>)

      // @ts-expect-error -- a condition is required
      void (<Can>x</Can>)
      // @ts-expect-error -- exactly one condition
      void (<Can permission="a" anyOf={['b']}>x</Can>)
      // @ts-expect-error -- `permission` is a single name; lists go in anyOf / allOf
      void (<Can permission={['a', 'b']}>x</Can>)
      // @ts-expect-error -- `role` belongs to <HasRole>
      void (<Can role="admin">x</Can>)
      // @ts-expect-error -- `permission` belongs to <Can>
      void (<HasRole permission="a">x</HasRole>)
      // @ts-expect-error -- exactly one condition
      void (<HasRole role="a" allOf={['b']}>x</HasRole>)
      // @ts-expect-error -- exactOptionalPropertyTypes: the condition cannot be an explicit undefined
      void (<Can permission={undefined}>x</Can>)
    }
  })
})

describe('createRbacChecker', () => {
  it('works on its own with the same options as the provider', () => {
    expectTypeOf(createRbacChecker).parameters.toEqualTypeOf<
      [snapshot: RbacSnapshot | null | undefined, options?: RbacCheckerOptions]
    >()
    expectTypeOf(createRbacChecker).returns.toEqualTypeOf<RbacChecker>()

    const checker = createRbacChecker(snapshot, { wildcard: true, superAdminRoles: ['admin'] })
    expectTypeOf(checker.can).toEqualTypeOf<(permission: string) => boolean>()
    expectTypeOf(checker.canAll).parameters.toEqualTypeOf<(string | readonly string[])[]>()

    void function neverCalled() {
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      createRbacChecker(null, { loading: undefined })
      // @ts-expect-error -- unknown option
      createRbacChecker(null, { wildCard: true })
    }
  })
})
