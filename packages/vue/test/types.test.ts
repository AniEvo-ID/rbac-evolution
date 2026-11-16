// Type tests: the public types are part of the API. `pnpm typecheck` (tsc) enforces the
// `expectTypeOf` assertions and every `@ts-expect-error` below; vitest only runs the shells.
// Calls that need an app / component instance live in functions that are never invoked.
import { describe, expectTypeOf, it } from 'vitest'
import type {
  App,
  ComponentCustomProperties,
  ComputedRef,
  DeepReadonly,
  Directive,
  GlobalComponents,
  GlobalDirectives,
  MaybeRefOrGetter,
  Plugin,
  Ref,
} from 'vue'
import { createApp, ref } from 'vue'
import {
  Can,
  createCanDirective,
  createRbacPlugin,
  createRbacState,
  createRoleDirective,
  HasRole,
  RBAC_KEY,
  useCan,
  useCanAll,
  useCanAny,
  useCannot,
  useHasAllRoles,
  useHasAnyRole,
  useHasRole,
  useRbac,
} from '../src'
import type { NameList, RbacPlugin, RbacPluginOptions, RbacSnapshot, RbacStateOptions, VueRbac } from '../src'

const snapshot: RbacSnapshot = { roles: ['writer'], permissions: ['edit articles'] }

describe('createRbacPlugin options', () => {
  it('all options are optional; the plugin is also the RBAC instance', () => {
    expectTypeOf(createRbacPlugin).parameters.toEqualTypeOf<[options?: RbacPluginOptions]>()
    expectTypeOf(createRbacPlugin).returns.toEqualTypeOf<RbacPlugin>()
    expectTypeOf<RbacPlugin>().toMatchTypeOf<VueRbac>()
    expectTypeOf<RbacPlugin>().toMatchTypeOf<Plugin>()
    expectTypeOf<RbacPluginOptions>().toMatchTypeOf<RbacStateOptions>()
    expectTypeOf<RbacStateOptions['snapshot']>().toEqualTypeOf<RbacSnapshot | null | undefined>()
    expectTypeOf<RbacStateOptions['superAdminRoles']>().toEqualTypeOf<readonly string[] | undefined>()

    const plugin = createRbacPlugin({
      snapshot,
      loading: true,
      wildcard: true,
      superAdminRoles: ['super-admin'] as const,
      directives: false,
      components: false,
      globalProperties: false,
    })
    createApp({}).use(plugin)
    expectTypeOf(plugin.setSnapshot).parameter(0).toEqualTypeOf<RbacSnapshot | null>()

    void function neverCalled() {
      createRbacPlugin()
      createRbacPlugin({ snapshot: null })
      // @ts-expect-error -- unknown option
      createRbacPlugin({ wildCard: true })
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      createRbacPlugin({ wildcard: undefined })
      // exactOptionalPropertyTypes: an explicit `undefined` is accepted, same as leaving the option out
      createRbacPlugin({ snapshot: undefined })
      // @ts-expect-error -- superAdminRoles is a list
      createRbacPlugin({ superAdminRoles: 'admin' })
      // @ts-expect-error -- the snapshot needs both lists
      createRbacPlugin({ snapshot: { roles: [] } })
      // @ts-expect-error -- setSnapshot needs a snapshot or null
      plugin.setSnapshot(undefined)
    }
  })
})

describe('VueRbac instance: refs vs plain values', () => {
  it('snapshot / loading are read-only refs; checks are plain synchronous booleans', () => {
    const rbac = createRbacState({ snapshot })
    expectTypeOf(rbac).toEqualTypeOf<VueRbac>()
    expectTypeOf(rbac.snapshot).toEqualTypeOf<Readonly<Ref<DeepReadonly<RbacSnapshot>>>>()
    expectTypeOf(rbac.snapshot.value.roles).toEqualTypeOf<readonly string[]>()
    expectTypeOf(rbac.loading).toEqualTypeOf<Readonly<Ref<boolean>>>()
    expectTypeOf(rbac.loading.value).toEqualTypeOf<boolean>()
    for (const check of [rbac.can, rbac.cannot, rbac.canAny, rbac.canAll, rbac.hasRole, rbac.hasAnyRole, rbac.hasAllRoles]) {
      expectTypeOf(check).toEqualTypeOf<(names: NameList) => boolean>()
    }
    expectTypeOf(rbac.isSuperAdmin).toEqualTypeOf<() => boolean>()
    expectTypeOf<NameList>().toEqualTypeOf<string | readonly string[]>()
    expectTypeOf(RBAC_KEY).toMatchTypeOf<symbol>()

    void function neverCalled() {
      rbac.can(['a', 'b'] as const)
      rbac.hasRole('writer|editor')
      // @ts-expect-error -- the snapshot is read-only
      rbac.snapshot.value = snapshot
      // @ts-expect-error -- the snapshot lists are read-only
      rbac.snapshot.value.roles.push('admin')
      // @ts-expect-error -- loading is read-only
      rbac.loading.value = false
      // @ts-expect-error -- names are strings
      rbac.can(1)
      // @ts-expect-error -- checks take one name or one list, not varargs
      rbac.canAny('a', 'b')
    }
  })
})

describe('composables', () => {
  it('useRbac() returns the instance; check composables accept a value, ref or getter and return ComputedRef<boolean>', () => {
    expectTypeOf(useRbac).parameters.toEqualTypeOf<[]>()
    expectTypeOf(useRbac).returns.toEqualTypeOf<VueRbac>()

    type Check = (names: MaybeRefOrGetter<NameList>) => ComputedRef<boolean>
    expectTypeOf(useCan).toEqualTypeOf<Check>()
    expectTypeOf(useCannot).toEqualTypeOf<Check>()
    expectTypeOf(useCanAny).toEqualTypeOf<Check>()
    expectTypeOf(useCanAll).toEqualTypeOf<Check>()
    expectTypeOf(useHasRole).toEqualTypeOf<Check>()
    expectTypeOf(useHasAnyRole).toEqualTypeOf<Check>()
    expectTypeOf(useHasAllRoles).toEqualTypeOf<Check>()

    void function neverCalled() {
      useCan('edit articles')
      useCan(ref(['a', 'b']))
      useCan(() => 'a')
      useHasRole(ref<readonly string[]>(['writer']))
      // @ts-expect-error -- names are strings
      useCan(ref(1))
      // @ts-expect-error -- one name, list, ref or getter — not varargs
      useCanAny('a', 'b')
      // @ts-expect-error -- the result is a ComputedRef, not a boolean
      const flag: boolean = useCan('a')
      void flag
    }
  })
})

describe('directives', () => {
  it('v-can / v-role are typed HTMLElement directives over NameList', () => {
    const rbac = createRbacState()
    expectTypeOf(createCanDirective(rbac)).toEqualTypeOf<Directive<HTMLElement, NameList>>()
    expectTypeOf(createRoleDirective(rbac)).toEqualTypeOf<Directive<HTMLElement, NameList>>()
    expectTypeOf<GlobalDirectives['vCan']>().toEqualTypeOf<Directive<HTMLElement, NameList>>()
    expectTypeOf<GlobalDirectives['vRole']>().toEqualTypeOf<Directive<HTMLElement, NameList>>()

    void function neverCalled(app: App) {
      app.directive('can', createCanDirective(rbac))
      // @ts-expect-error -- the factory needs the RBAC instance
      createCanDirective()
    }
  })
})

describe('global properties ($can, …) and global components', () => {
  it('ComponentCustomProperties is augmented with $rbac and the checks', () => {
    expectTypeOf<ComponentCustomProperties['$rbac']>().toEqualTypeOf<VueRbac>()
    expectTypeOf<ComponentCustomProperties['$can']>().toEqualTypeOf<(permission: NameList) => boolean>()
    expectTypeOf<ComponentCustomProperties['$cannot']>().toEqualTypeOf<(permission: NameList) => boolean>()
    expectTypeOf<ComponentCustomProperties['$canAny']>().toEqualTypeOf<(permissions: NameList) => boolean>()
    expectTypeOf<ComponentCustomProperties['$canAll']>().toEqualTypeOf<(permissions: NameList) => boolean>()
    expectTypeOf<ComponentCustomProperties['$hasRole']>().toEqualTypeOf<(roles: NameList) => boolean>()
    expectTypeOf<ComponentCustomProperties['$hasAnyRole']>().toEqualTypeOf<(roles: NameList) => boolean>()
    expectTypeOf<ComponentCustomProperties['$hasAllRoles']>().toEqualTypeOf<(roles: NameList) => boolean>()

    void function neverCalled(props: ComponentCustomProperties) {
      props.$can(['a', 'b'])
      // @ts-expect-error -- names are strings
      props.$can(1)
      // @ts-expect-error -- not declared (no $isSuperAdmin global)
      void props.$isSuperAdmin
    }
  })

  it('<Can> / <HasRole> are registered in GlobalComponents with typed props', () => {
    expectTypeOf<GlobalComponents['Can']>().toEqualTypeOf<typeof Can>()
    expectTypeOf<GlobalComponents['HasRole']>().toEqualTypeOf<typeof HasRole>()

    type CanProps = InstanceType<typeof Can>['$props']
    type HasRoleProps = InstanceType<typeof HasRole>['$props']
    expectTypeOf<CanProps['permission']>().toEqualTypeOf<NameList | undefined>()
    expectTypeOf<CanProps['anyOf']>().toEqualTypeOf<NameList | undefined>()
    expectTypeOf<CanProps['allOf']>().toEqualTypeOf<NameList | undefined>()
    expectTypeOf<CanProps['not']>().toEqualTypeOf<boolean | undefined>()
    expectTypeOf<HasRoleProps['role']>().toEqualTypeOf<NameList | undefined>()

    // Inside the component, props with defaults are resolved.
    type CanSetupProps = InstanceType<typeof Can>['$props'] & InstanceType<typeof Can>
    expectTypeOf<CanSetupProps['not']>().toEqualTypeOf<boolean>()
  })
})
