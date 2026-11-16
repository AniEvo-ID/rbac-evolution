/**
 * Type tests for the public API: types are part of the contract.
 *
 * Every `expectTypeOf(...)` and `// @ts-expect-error` here is enforced by `tsc --noEmit`
 * (the `typecheck` script), with the repo's `strict`, `exactOptionalPropertyTypes` and
 * `noUncheckedIndexedAccess` settings. Calls that are only meant to be type-checked live
 * in functions that are never executed, so the runtime test stays side-effect free.
 *
 * Complements `typed-names.test.ts` (which covers name narrowing on most subject/role methods).
 */
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  type BeforeContext,
  type BeforeHook,
  type CacheStore,
  createRbac,
  type DefaultRbacTypes,
  type ExpiryArgs,
  type FindPermissionsQuery,
  type FindRolesQuery,
  GuardDoesNotMatch,
  type GuardOptions,
  type Id,
  InvalidWildcardPermission,
  MemoryAdapter,
  MemoryCache,
  type MemoryCacheOptions,
  type Many,
  type Permission,
  PermissionAlreadyExists,
  type PermissionAttachedEvent,
  type PermissionCreatedEvent,
  type PermissionDeletedEvent,
  type PermissionDetachedEvent,
  PermissionDoesNotExist,
  type PermissionInput,
  type PermissionRequirementOptions,
  permissionRequirement,
  parseWildcardPermission,
  Rbac,
  type RbacAdapter,
  RbacError,
  type RbacErrorCode,
  type RbacEvent,
  type RbacEventListener,
  type RbacEventMap,
  type RbacEventName,
  type RbacOptions,
  type RbacRequirement,
  type RbacSnapshot,
  REQUIREMENT_MESSAGES,
  type RequirementKind,
  type RequirementNames,
  type RequirementArgs,
  type CheckRequirementName,
  type UnknownRequirementName,
  type Role,
  RoleAlreadyExists,
  type RoleAttachedEvent,
  type RoleCreatedEvent,
  type RoleDeletedEvent,
  type RoleDetachedEvent,
  RoleDoesNotExist,
  type RoleInput,
  type RoleRbac,
  type RoleRequirementOptions,
  roleOrPermissionRequirement,
  roleRequirement,
  type RolePermissionLink,
  satisfiesRequirement,
  type ScopeOptions,
  type Subject,
  SubjectRbac,
  splitRequirementArgs,
  type SyncDefinition,
  type SyncOptions,
  type SyncResult,
  type TeamId,
  UNAUTHENTICATED_MESSAGE,
  VERSION,
  wildcardImplies,
} from '../src'

type AppTypes = { permissions: 'edit articles' | 'delete articles'; roles: 'writer' | 'admin' }
type AppPermission = 'edit articles' | 'delete articles'
type AppRole = 'writer' | 'admin'

const alice: Subject = { type: 'user', id: 1 }

/** Values whose type is "maybe undefined", like an optional config field or `process.env.X`. */
const maybeString = undefined as string | undefined
const maybeBoolean = undefined as boolean | undefined
const maybeTeam = undefined as TeamId | undefined

describe('type tests', () => {
  describe('createRbac / Rbac', () => {
    it('returns Rbac<T> and keeps the defaults untyped', () => {
      const untyped = createRbac({ adapter: new MemoryAdapter() })
      const typed = createRbac<AppTypes>({ adapter: new MemoryAdapter() })

      expectTypeOf(untyped).toEqualTypeOf<Rbac<DefaultRbacTypes>>()
      expectTypeOf(untyped).toEqualTypeOf<Rbac>()
      expectTypeOf(typed).toEqualTypeOf<Rbac<AppTypes>>()
      expectTypeOf(createRbac<AppTypes>).parameter(0).toEqualTypeOf<RbacOptions<AppTypes>>()
      expectTypeOf(new Rbac({ adapter: new MemoryAdapter() })).toEqualTypeOf<Rbac>()

      // Public readonly configuration.
      expectTypeOf(typed.adapter).toEqualTypeOf<RbacAdapter>()
      expectTypeOf(typed.defaultGuard).toBeString()
      expectTypeOf(typed.wildcard).toBeBoolean()
      expectTypeOf(typed.teams).toBeBoolean()

      expect(typed).toBeInstanceOf(Rbac)
    })

    it('narrows names on the Rbac methods (and accepts any string by default)', () => {
      const typed = createRbac<AppTypes>({ adapter: new MemoryAdapter() })
      const untyped = createRbac({ adapter: new MemoryAdapter() })

      expectTypeOf(typed.createPermission).parameter(0).toEqualTypeOf<AppPermission>()
      expectTypeOf(typed.findPermission).parameter(0).toEqualTypeOf<AppPermission>()
      expectTypeOf(typed.findOrCreatePermission).parameter(0).toEqualTypeOf<AppPermission>()
      expectTypeOf(typed.deletePermission).parameter(0).toEqualTypeOf<AppPermission | Permission>()
      expectTypeOf(typed.createRole).parameter(0).toEqualTypeOf<AppRole>()
      expectTypeOf(typed.findRole).parameter(0).toEqualTypeOf<AppRole>()
      expectTypeOf(typed.findOrCreateRole).parameter(0).toEqualTypeOf<AppRole>()
      expectTypeOf(typed.deleteRole).parameter(0).toEqualTypeOf<AppRole | Role>()
      expectTypeOf(typed.role).parameter(0).toEqualTypeOf<AppRole | Role>()
      expectTypeOf(typed.subjectsWithRole).parameter(1).toEqualTypeOf<Many<AppRole | Role>>()
      expectTypeOf(typed.subjectsWithPermission).parameter(1).toEqualTypeOf<Many<AppPermission | Permission>>()

      expectTypeOf(untyped.createPermission).parameter(0).toEqualTypeOf<string>()
      expectTypeOf(untyped.createRole).parameter(0).toEqualTypeOf<string>()
      expectTypeOf(untyped.role).parameter(0).toEqualTypeOf<string | Role>()
      expectTypeOf(untyped.sync).parameter(0).toEqualTypeOf<SyncDefinition | readonly SyncDefinition[]>()

      const typeOnly = async (rbac: Rbac<AppTypes>, any: Rbac): Promise<void> => {
        // @ts-expect-error unknown permission
        await rbac.findPermission('fly')
        // @ts-expect-error unknown permission
        await rbac.findOrCreatePermission('fly')
        // @ts-expect-error unknown permission
        await rbac.deletePermission('fly')
        // @ts-expect-error unknown role
        await rbac.findRole('ghost')
        // @ts-expect-error unknown role
        await rbac.findOrCreateRole('ghost')
        // @ts-expect-error unknown role
        await rbac.deleteRole('ghost')
        // @ts-expect-error unknown permission on a role
        await rbac.role('writer').hasPermissionTo('fly')
        // @ts-expect-error unknown permission on a role
        await rbac.role('writer').syncPermissions(['edit articles', 'fly'])
        // @ts-expect-error a number is not a name
        await rbac.createRole(1)

        // Default instances accept any string.
        await any.createPermission('anything at all')
        await any.createRole('whatever')
        await any.for(alice).can('fly')
        await any.for(alice).assignRole('ghost')
      }
      expect(typeof typeOnly).toBe('function')
    })

    it('types sync definitions with the configured names', () => {
      const typeOnly = async (rbac: Rbac<AppTypes>): Promise<void> => {
        const result = await rbac.sync({
          permissions: ['edit articles', 'delete articles'],
          roles: { admin: '*', writer: ['edit articles'] },
        })
        expectTypeOf(result).toEqualTypeOf<SyncResult>()
        await rbac.sync([{ guard: 'api', roles: { writer: [] } }], { prune: true, dryRun: true })

        // @ts-expect-error unknown permission
        await rbac.sync({ permissions: ['fly'] })
        // @ts-expect-error unknown role key
        await rbac.sync({ roles: { ghost: '*' } })
        // @ts-expect-error unknown permission in a role
        await rbac.sync({ roles: { writer: ['fly'] } })
        // @ts-expect-error only '*' is accepted as a non-array value
        await rbac.sync({ roles: { writer: 'all' } })
        // @ts-expect-error unknown option
        await rbac.sync({}, { force: true })
      }

      expectTypeOf<SyncResult['dryRun']>().toBeBoolean()
      expectTypeOf<SyncResult['created']['roles'][number]['team']>().toEqualTypeOf<TeamId>()
      expectTypeOf<SyncResult['updated']['roles'][number]['attached']>().toEqualTypeOf<string[]>()
      expect(typeof typeOnly).toBe('function')
    })

    it('has the documented return types', () => {
      const rbac = createRbac<AppTypes>({ adapter: new MemoryAdapter() })

      expectTypeOf(rbac.createPermission).returns.toEqualTypeOf<Promise<Permission>>()
      expectTypeOf(rbac.findPermission).returns.toEqualTypeOf<Promise<Permission | null>>()
      expectTypeOf(rbac.findPermissionOrFail).returns.toEqualTypeOf<Promise<Permission>>()
      expectTypeOf(rbac.getPermissions).returns.toEqualTypeOf<Promise<Permission[]>>()
      expectTypeOf(rbac.deletePermission).returns.toEqualTypeOf<Promise<void>>()
      expectTypeOf(rbac.createRole).returns.toEqualTypeOf<Promise<Role>>()
      expectTypeOf(rbac.findRole).returns.toEqualTypeOf<Promise<Role | null>>()
      expectTypeOf(rbac.findRoleOrFail).returns.toEqualTypeOf<Promise<Role>>()
      expectTypeOf(rbac.getRoles).returns.toEqualTypeOf<Promise<Role[]>>()
      expectTypeOf(rbac.deleteRole).returns.toEqualTypeOf<Promise<void>>()
      expectTypeOf(rbac.sync).returns.toEqualTypeOf<Promise<SyncResult>>()
      expectTypeOf(rbac.subjectsWithRole).returns.toEqualTypeOf<Promise<Id[]>>()
      expectTypeOf(rbac.subjectsWithPermission).returns.toEqualTypeOf<Promise<Id[]>>()
      expectTypeOf(rbac.forgetCachedPermissions).returns.toEqualTypeOf<Promise<void>>()
      expectTypeOf(rbac.for).returns.toEqualTypeOf<SubjectRbac<AppTypes>>()
      expectTypeOf(rbac.role).returns.toEqualTypeOf<RoleRbac<AppTypes>>()

      expect(rbac.for(alice)).toBeInstanceOf(SubjectRbac)
    })

    it('hides the engine internals', () => {
      const typeOnly = (rbac: Rbac<AppTypes>): void => {
        // @ts-expect-error internal
        void rbac.gate
        // @ts-expect-error internal
        void rbac.resolveGuard
        // @ts-expect-error internal
        void rbac.resolveTeam
        // @ts-expect-error internal
        void rbac.resolvePermissions
        // @ts-expect-error internal
        void rbac.events
        // @ts-expect-error internal
        void rbac.internals
        // @ts-expect-error internal
        void rbac.remember
        // @ts-expect-error internal
        void rbac.cache
        // @ts-expect-error private static helper
        void Rbac.pickRole
        // @ts-expect-error readonly configuration
        rbac.defaultGuard = 'api'

        const user = rbac.for(alice)
        // @ts-expect-error private back-reference
        void user.rbac
        // @ts-expect-error private helper
        void user.check
        // @ts-expect-error private helper
        void user.state

        const role = rbac.role('writer')
        // @ts-expect-error private back-reference
        void role.rbac
        // @ts-expect-error private helper
        void role.emit
      }

      expectTypeOf<keyof Rbac>().not.toEqualTypeOf<'gate' | 'events' | 'resolveGuard' | 'internals'>()
      expectTypeOf<Rbac>().not.toHaveProperty('gate')
      expectTypeOf<Rbac>().not.toHaveProperty('events')
      expectTypeOf<Rbac>().not.toHaveProperty('resolveGuard')
      expectTypeOf<SubjectRbac>().not.toHaveProperty('rbac')
      expectTypeOf<RoleRbac>().not.toHaveProperty('input')

      // Internal value exports stay out of the package entry point.
      type Entry = typeof import('../src')
      expectTypeOf<Entry>().not.toHaveProperty('RbacEmitter')
      expectTypeOf<Entry>().not.toHaveProperty('syncDefinition')
      expectTypeOf<Entry>().not.toHaveProperty('internalsOf')
      expectTypeOf<Entry>().toHaveProperty('VERSION').toBeString()

      expect(typeof typeOnly).toBe('function')
      expect(typeof VERSION).toBe('string')
    })
  })

  describe('SubjectRbac / RoleRbac', () => {
    it('narrows names and returns chainable `this`', () => {
      const rbac = createRbac<AppTypes>({ adapter: new MemoryAdapter() })
      const user = rbac.for(alice)
      const role = rbac.role('writer')

      expectTypeOf(user.can).parameter(0).toEqualTypeOf<AppPermission | Permission>()
      expectTypeOf(user.cannot).parameter(0).toEqualTypeOf<PermissionInput<AppPermission>>()
      expectTypeOf(user.hasRole).parameter(0).toEqualTypeOf<Many<RoleInput<AppRole>>>()
      // Subject writes take an optional `{ expiresAt }` last (1.2).
      expectTypeOf(user.assignRole).parameters.toEqualTypeOf<ExpiryArgs<Many<AppRole | Role>>>()
      expectTypeOf(user.givePermissionTo).parameters.toEqualTypeOf<ExpiryArgs<Many<AppPermission | Permission>>>()
      expectTypeOf(user.removeRole).parameters.toEqualTypeOf<Many<AppRole | Role>[]>()
      expectTypeOf(role.givePermissionTo).parameters.toEqualTypeOf<Many<AppPermission | Permission>[]>()

      // `this`-returning mutators chain.
      expectTypeOf(user.assignRole).returns.toEqualTypeOf<Promise<SubjectRbac<AppTypes>>>()
      expectTypeOf(user.removeRole).returns.toEqualTypeOf<Promise<SubjectRbac<AppTypes>>>()
      expectTypeOf(user.syncRoles).returns.toEqualTypeOf<Promise<SubjectRbac<AppTypes>>>()
      expectTypeOf(user.givePermissionTo).returns.toEqualTypeOf<Promise<SubjectRbac<AppTypes>>>()
      expectTypeOf(user.revokePermissionTo).returns.toEqualTypeOf<Promise<SubjectRbac<AppTypes>>>()
      expectTypeOf(user.syncPermissions).returns.toEqualTypeOf<Promise<SubjectRbac<AppTypes>>>()
      expectTypeOf(role.givePermissionTo).returns.toEqualTypeOf<Promise<RoleRbac<AppTypes>>>()
      expectTypeOf(role.revokePermissionTo).returns.toEqualTypeOf<Promise<RoleRbac<AppTypes>>>()
      expectTypeOf(role.syncPermissions).returns.toEqualTypeOf<Promise<RoleRbac<AppTypes>>>()
      expectTypeOf(role.syncSubjects).returns.toEqualTypeOf<Promise<RoleRbac<AppTypes>>>()

      // Checks.
      expectTypeOf(user.can).returns.toEqualTypeOf<Promise<boolean>>()
      expectTypeOf(user.cannot).returns.toEqualTypeOf<Promise<boolean>>()
      expectTypeOf(user.canAny).returns.toEqualTypeOf<Promise<boolean>>()
      expectTypeOf(user.canAll).returns.toEqualTypeOf<Promise<boolean>>()
      expectTypeOf(user.hasRole).returns.toEqualTypeOf<Promise<boolean>>()
      expectTypeOf(user.hasPermissionTo).returns.toEqualTypeOf<Promise<boolean>>()
      expectTypeOf(role.hasPermissionTo).returns.toEqualTypeOf<Promise<boolean>>()

      // Reads (names come back as plain strings, also on typed instances).
      expectTypeOf(user.snapshot).returns.toEqualTypeOf<Promise<RbacSnapshot>>()
      expectTypeOf(user.getRoles).returns.toEqualTypeOf<Promise<Role[]>>()
      expectTypeOf(user.getRoleNames).returns.toEqualTypeOf<Promise<string[]>>()
      expectTypeOf(user.getAllPermissions).returns.toEqualTypeOf<Promise<Permission[]>>()
      expectTypeOf(user.getPermissionNames).returns.toEqualTypeOf<Promise<string[]>>()
      expectTypeOf(role.get).returns.toEqualTypeOf<Promise<Role>>()
      expectTypeOf(role.getPermissionNames).returns.toEqualTypeOf<Promise<string[]>>()
      // `denied` is optional (1.x addition): snapshots without it stay valid.
      expectTypeOf<RbacSnapshot>().toEqualTypeOf<{ roles: string[]; permissions: string[]; denied?: string[] | undefined }>()
      expectTypeOf<{ roles: string[]; permissions: string[] }>().toMatchTypeOf<RbacSnapshot>()

      // Resolved scope.
      expectTypeOf(user.subject).toEqualTypeOf<Subject>()
      expectTypeOf(user.guardName).toBeString()
      expectTypeOf(user.teamId).toEqualTypeOf<TeamId>()
      expectTypeOf(role.guardName).toBeString()
      expectTypeOf(role.teamId).toEqualTypeOf<TeamId>()

      const typeOnly = async (): Promise<void> => {
        const chained = await (await user.assignRole('writer')).givePermissionTo('edit articles')
        expectTypeOf(chained).toEqualTypeOf<SubjectRbac<AppTypes>>()
        const roleChain = await (await role.givePermissionTo('edit articles')).revokePermissionTo(['delete articles'])
        expectTypeOf(roleChain).toEqualTypeOf<RoleRbac<AppTypes>>()
        // @ts-expect-error readonly scope
        user.teamId = 1
      }
      expect(typeof typeOnly).toBe('function')
    })
  })

  describe('core value types', () => {
    it('Subject, Id and TeamId', () => {
      expectTypeOf<Id>().toEqualTypeOf<string | number>()
      expectTypeOf<TeamId>().toEqualTypeOf<string | number | null>()
      expectTypeOf<null>().toExtend<TeamId>()
      expectTypeOf<undefined>().not.toExtend<TeamId>()
      expectTypeOf<Subject['id']>().toEqualTypeOf<Id>()
      expectTypeOf<Role['teamId']>().toEqualTypeOf<TeamId>()
      expectTypeOf<Permission>().toEqualTypeOf<{ id: Id; name: string; guardName: string }>()

      const numeric: Subject = { type: 'user', id: 1 }
      const uuid: Subject = { type: 'user', id: '7c9e6679-7425-40de-944b-e07fc1f90ae7' }
      // @ts-expect-error ids are strings or numbers
      const bad: Subject = { type: 'user', id: true }
      // @ts-expect-error `type` is required
      const untyped: Subject = { id: 1 }
      // Extra fields are fine when the subject is a variable (e.g. a full user model).
      const user = { type: 'user', id: 2, email: 'a@example.com' }
      const asSubject: Subject = user

      expect([numeric, uuid, bad, untyped, asSubject]).toHaveLength(5)
    })

    it('Many accepts a value or a readonly array', () => {
      expectTypeOf<'a'>().toExtend<Many<'a'>>()
      expectTypeOf<readonly 'a'[]>().toExtend<Many<'a'>>()
      expectTypeOf<'a'[]>().toExtend<Many<'a'>>()
      expectTypeOf<PermissionInput>().toEqualTypeOf<string | Permission>()
      expectTypeOf<RoleInput<'x'>>().toEqualTypeOf<'x' | Role>()
    })
  })

  describe('events', () => {
    it('maps event names to payloads', () => {
      expectTypeOf<RbacEventName>().toEqualTypeOf<
        | 'role.attached'
        | 'role.detached'
        | 'permission.attached'
        | 'permission.detached'
        | 'role.created'
        | 'role.deleted'
        | 'permission.created'
        | 'permission.deleted'
      >()
      expectTypeOf<RbacEventMap['role.attached']>().toEqualTypeOf<RoleAttachedEvent>()
      expectTypeOf<RbacEventMap['role.detached']>().toEqualTypeOf<RoleDetachedEvent>()
      expectTypeOf<RbacEventMap['permission.attached']>().toEqualTypeOf<PermissionAttachedEvent>()
      expectTypeOf<RbacEventMap['permission.detached']>().toEqualTypeOf<PermissionDetachedEvent>()
      expectTypeOf<RbacEventMap['role.created']>().toEqualTypeOf<RoleCreatedEvent>()
      expectTypeOf<RbacEventMap['role.deleted']>().toEqualTypeOf<RoleDeletedEvent>()
      expectTypeOf<RbacEventMap['permission.created']>().toEqualTypeOf<PermissionCreatedEvent>()
      expectTypeOf<RbacEventMap['permission.deleted']>().toEqualTypeOf<PermissionDeletedEvent>()
      expectTypeOf<RbacEvent['event']>().toEqualTypeOf<RbacEventName>()
      expectTypeOf<RbacEventListener<'role.created'>>().toEqualTypeOf<
        (payload: RoleCreatedEvent) => void | Promise<void>
      >()
    })

    it('types `on` / `off` listeners and returns an unsubscribe function', () => {
      const rbac = createRbac<AppTypes>({ adapter: new MemoryAdapter() })

      const offAttached = rbac.on('role.attached', (e) => {
        expectTypeOf(e).toEqualTypeOf<RoleAttachedEvent>()
        expectTypeOf(e.roles).toEqualTypeOf<Role[]>()
        expectTypeOf(e.subject).toEqualTypeOf<Subject>()
        expectTypeOf(e.teamId).toEqualTypeOf<TeamId>()
      })
      const offPermission = rbac.on('permission.attached', async (e) => {
        expectTypeOf(e.permissions).toEqualTypeOf<Permission[]>()
        if (e.target === 'role') {
          expectTypeOf(e.role).toEqualTypeOf<Role>()
        } else {
          expectTypeOf(e.subject).toEqualTypeOf<Subject>()
        }
      })
      expectTypeOf(offAttached).toEqualTypeOf<() => void>()
      expectTypeOf(rbac.on).returns.toEqualTypeOf<() => void>()
      expectTypeOf(rbac.off).returns.toBeVoid()
      expectTypeOf(rbac.on).parameter(0).toEqualTypeOf<RbacEventName>()

      const onCreated: RbacEventListener<'role.created'> = (e) => {
        expectTypeOf(e.role).toEqualTypeOf<Role>()
      }
      rbac.on('role.created', onCreated)
      rbac.off('role.created', onCreated)

      const typeOnly = (): void => {
        // @ts-expect-error unknown event name
        rbac.on('role.updated', () => {})
        // @ts-expect-error listener for another event's payload
        rbac.on('role.created', (e: RoleAttachedEvent) => e.roles)
        // @ts-expect-error `permission.created` has no `role`
        rbac.on('permission.created', (e) => e.role)
        // @ts-expect-error unknown event name
        rbac.off('nope', () => {})
      }

      offAttached()
      offPermission()
      expect(typeof typeOnly).toBe('function')
    })
  })

  describe('errors', () => {
    it('exposes a closed union of codes and a common base class', () => {
      expectTypeOf<RbacErrorCode>().toExtend<string>()
      expectTypeOf<'ROLE_DOES_NOT_EXIST'>().toExtend<RbacErrorCode>()
      expectTypeOf<'TEAMS_NOT_ENABLED'>().toExtend<RbacErrorCode>()
      expectTypeOf<'INVALID_SYNC_DEFINITION'>().toExtend<RbacErrorCode>()
      expectTypeOf<string>().not.toExtend<RbacErrorCode>()
      expectTypeOf<'NOT_A_CODE'>().not.toExtend<RbacErrorCode>()

      expectTypeOf<RbacError>().toExtend<Error>()
      expectTypeOf<RbacError['code']>().toEqualTypeOf<RbacErrorCode>()
      expectTypeOf<PermissionDoesNotExist>().toExtend<RbacError>()
      expectTypeOf<PermissionAlreadyExists>().toExtend<RbacError>()
      expectTypeOf<RoleDoesNotExist>().toExtend<RbacError>()
      expectTypeOf<RoleAlreadyExists>().toExtend<RbacError>()
      expectTypeOf<GuardDoesNotMatch>().toExtend<RbacError>()
      expectTypeOf<InvalidWildcardPermission>().toExtend<RbacError>()

      expectTypeOf(RbacError).constructorParameters.toEqualTypeOf<[code: RbacErrorCode, message: string]>()
      expectTypeOf(RoleDoesNotExist).constructorParameters.toEqualTypeOf<[name: string, guardName: string]>()
      expectTypeOf(InvalidWildcardPermission).constructorParameters.toEqualTypeOf<[permission: string]>()

      const error: unknown = new RoleDoesNotExist('ghost', 'web')
      if (error instanceof RbacError) {
        expectTypeOf(error.code).toEqualTypeOf<RbacErrorCode>()
        // Codes are exhaustively switchable.
        const label = (code: RbacErrorCode): string => {
          switch (code) {
            case 'PERMISSION_DOES_NOT_EXIST':
            case 'PERMISSION_ALREADY_EXISTS':
            case 'ROLE_DOES_NOT_EXIST':
            case 'ROLE_ALREADY_EXISTS':
            case 'GUARD_DOES_NOT_MATCH':
            case 'TEAM_DOES_NOT_MATCH':
            case 'TEAMS_NOT_ENABLED':
            case 'INVALID_NAME':
            case 'INVALID_WILDCARD_PERMISSION':
            case 'INVALID_SYNC_DEFINITION':
            case 'ADAPTER_METHOD_MISSING':
            case 'EXPIRY_NOT_SUPPORTED':
              return code
            default: {
              const never: never = code
              return never
            }
          }
        }
        expect(label(error.code)).toBe('ROLE_DOES_NOT_EXIST')
      }

      const typeOnly = (): void => {
        // @ts-expect-error not a known code
        void new RbacError('NOPE', 'message')
        // @ts-expect-error readonly
        new RbacError('INVALID_NAME', 'x').code = 'TEAMS_NOT_ENABLED'
      }
      expect(typeof typeOnly).toBe('function')
    })
  })

  describe('requirements', () => {
    it('types the requirement helpers', () => {
      expectTypeOf<RequirementKind>().toEqualTypeOf<'permission' | 'role' | 'role_or_permission'>()
      expectTypeOf<RequirementNames>().toEqualTypeOf<string | readonly string[]>()
      expectTypeOf<RbacRequirement>().toEqualTypeOf<{ kind: RequirementKind; requirements: string[][] }>()
      expectTypeOf(REQUIREMENT_MESSAGES).toEqualTypeOf<Readonly<Record<RequirementKind, string>>>()
      expectTypeOf<typeof UNAUTHENTICATED_MESSAGE>().toEqualTypeOf<'User is not logged in.'>()

      expectTypeOf(permissionRequirement).parameters.toEqualTypeOf<
        [names: readonly RequirementNames[], options?: PermissionRequirementOptions]
      >()
      expectTypeOf(roleRequirement).parameters.toEqualTypeOf<
        [names: readonly RequirementNames[], options?: RoleRequirementOptions]
      >()
      expectTypeOf(roleOrPermissionRequirement).parameters.toEqualTypeOf<[names: readonly RequirementNames[]]>()
      expectTypeOf(permissionRequirement).returns.toEqualTypeOf<RbacRequirement>()
      expectTypeOf(roleRequirement).returns.toEqualTypeOf<RbacRequirement>()
      expectTypeOf(roleOrPermissionRequirement).returns.toEqualTypeOf<RbacRequirement>()
      expectTypeOf(satisfiesRequirement).parameters.toEqualTypeOf<
        [rbac: SubjectRbac, requirement: RbacRequirement]
      >()
      expectTypeOf(satisfiesRequirement).returns.toEqualTypeOf<Promise<boolean>>()

      // Options objects.
      expect(permissionRequirement(['a', 'b|c', ['d']], { any: true }).kind).toBe('permission')
      expect(roleRequirement(['a'], { all: true }).kind).toBe('role')
      expect(roleOrPermissionRequirement(['a|b']).kind).toBe('role_or_permission')

      const typeOnly = async (typed: SubjectRbac<AppTypes>): Promise<void> => {
        // @ts-expect-error `all` is a role option
        permissionRequirement(['a'], { all: true })
        // @ts-expect-error `any` is a permission option
        roleRequirement(['a'], { any: true })
        // @ts-expect-error names must be wrapped in an array
        permissionRequirement('edit')
        // @ts-expect-error no options
        roleOrPermissionRequirement(['a'], { any: true })
        // @ts-expect-error boolean only
        permissionRequirement(['a'], { any: 'yes' })

        // A typed subject can be checked (framework packages accept the default `SubjectRbac`).
        await satisfiesRequirement(typed, permissionRequirement(['edit articles']))
      }
      expect(typeof typeOnly).toBe('function')
    })

    it('splits `(...names, options?)` guard arguments', () => {
      const split = splitRequirementArgs<PermissionRequirementOptions>(['a', ['b', 'c'], { any: true }])
      expectTypeOf(split).toEqualTypeOf<{ names: RequirementNames[]; options: PermissionRequirementOptions | undefined }>()
      expect(split.options).toEqual({ any: true })

      const roles = splitRequirementArgs<RoleRequirementOptions>(['admin'])
      expectTypeOf(roles.options).toEqualTypeOf<RoleRequirementOptions | undefined>()
      expect(roles.options).toBeUndefined()

      // The split options flow straight into the builders.
      expect(permissionRequirement(split.names, split.options).requirements).toEqual([['a', 'b', 'c']])

      const typeOnly = (): void => {
        // @ts-expect-error a number is neither a name nor an options object
        splitRequirementArgs<RoleRequirementOptions>([1])
      }
      expect(typeof typeOnly).toBe('function')
    })
  })

  describe('exactOptionalPropertyTypes', () => {
    it('requirement options accept explicit `undefined` (declared `| undefined`)', () => {
      const permission: PermissionRequirementOptions = { any: maybeBoolean }
      const role: RoleRequirementOptions = { all: undefined }
      expect(permissionRequirement(['a'], permission).kind).toBe('permission')
      expect(roleRequirement(['a'], role).kind).toBe('role')
      expect(roleRequirement(['a'], { all: maybeBoolean }).kind).toBe('role')
    })

    it('engine options accept explicit `undefined` too (declared `| undefined`)', () => {
      // `{ guard: maybeGuard }` works under exactOptionalPropertyTypes; `undefined` means "use the default".
      const guard: GuardOptions = { guard: maybeString }
      const scope: ScopeOptions = { team: maybeTeam }
      const options: RbacOptions = { adapter: new MemoryAdapter(), defaultGuard: maybeString }
      const sync: SyncOptions = { dryRun: maybeBoolean }
      const cache: MemoryCacheOptions = { maxEntries: undefined }
      const definition: SyncDefinition = { guard: undefined }
      const query: FindPermissionsQuery = { guardName: maybeString }

      // The other patterns keep working: omit the key, use `null` for "no team", or spread conditionally.
      const omitted: ScopeOptions = {}
      const global: ScopeOptions = { team: null }
      const spread: ScopeOptions = { ...(maybeString !== undefined && { guard: maybeString }) }
      const typeOnly = (rbac: Rbac): void => {
        rbac.for(alice, { guard: maybeString })
        rbac.for(alice, spread)
      }

      expect([guard, scope, options, sync, cache, definition, query, omitted, global]).toHaveLength(9)
      expect(typeof typeOnly).toBe('function')
    })

    it('types the `before` hook and `superAdminRoles`', () => {
      const before: BeforeHook<AppTypes> = (ctx) => {
        expectTypeOf(ctx).toEqualTypeOf<BeforeContext<AppTypes>>()
        expectTypeOf(ctx.subject).toEqualTypeOf<SubjectRbac<AppTypes>>()
        expectTypeOf(ctx.permission).toBeString()
        return ctx.permission === 'edit articles' ? true : undefined
      }
      expectTypeOf(before).returns.toEqualTypeOf<boolean | undefined | Promise<boolean | undefined>>()
      const asyncBefore: BeforeHook = async () => undefined

      const rbac = createRbac<AppTypes>({ adapter: new MemoryAdapter(), before, superAdminRoles: ['admin'] })
      expectTypeOf<RbacOptions<AppTypes>['superAdminRoles']>().toEqualTypeOf<readonly AppRole[] | undefined>()
      expectTypeOf<RbacOptions['cache']>().toEqualTypeOf<CacheStore | false | undefined>()

      const typeOnly = (): void => {
        // @ts-expect-error `before` must return boolean | undefined
        createRbac({ adapter: new MemoryAdapter(), before: () => 'yes' })
        // @ts-expect-error `adapter` is required
        createRbac({})
        // @ts-expect-error unknown option
        createRbac({ adapter: new MemoryAdapter(), guard: 'web' })
        // @ts-expect-error `cache: true` is not a store
        createRbac({ adapter: new MemoryAdapter(), cache: true })
      }

      expect(rbac).toBeInstanceOf(Rbac)
      expect(typeof asyncBefore).toBe('function')
      expect(typeof typeOnly).toBe('function')
    })
  })

  describe('extension points', () => {
    it('CacheStore accepts sync and async implementations', async () => {
      const map = new Map<string, unknown>()
      const sync: CacheStore = {
        get: (key) => map.get(key),
        set: (key, value) => {
          map.set(key, value)
        },
        clear: () => map.clear(),
      }

      class AsyncStore implements CacheStore {
        readonly data = new Map<string, unknown>()
        async get(key: string): Promise<unknown> {
          return this.data.get(key)
        }
        async set(key: string, value: unknown, _ttlMs: number): Promise<void> {
          this.data.set(key, value)
        }
        async clear(): Promise<void> {
          this.data.clear()
        }
      }

      expectTypeOf<MemoryCache>().toExtend<CacheStore>()
      expectTypeOf<AsyncStore>().toExtend<CacheStore>()
      expectTypeOf<CacheStore['get']>().returns.toEqualTypeOf<unknown>()
      expectTypeOf<CacheStore['set']>().returns.toEqualTypeOf<void | Promise<void>>()

      const rbac = createRbac({ adapter: new MemoryAdapter(), cache: sync })
      const asyncRbac = createRbac({ adapter: new MemoryAdapter(), cache: new AsyncStore(), cacheTtl: 1000 })
      const noCache = createRbac({ adapter: new MemoryAdapter(), cache: false })

      await rbac.createPermission('edit')
      await asyncRbac.createPermission('edit')
      await noCache.createPermission('edit')
      expect(await rbac.for(alice).can('edit')).toBe(false)
      expect(await asyncRbac.for(alice).can('edit')).toBe(false)

      const typeOnly = (): void => {
        // @ts-expect-error `clear` is required
        const partial: CacheStore = { get: () => undefined, set: () => {} }
        void partial
      }
      expect(typeof typeOnly).toBe('function')
    })

    it('RbacAdapter is implementable by a plain object', async () => {
      const none = async (): Promise<void> => {}
      const adapter: RbacAdapter = {
        createPermission: async ({ name, guardName }) => ({ id: 1, name, guardName }),
        findPermissions: async (query?: FindPermissionsQuery) => {
          expectTypeOf(query).toEqualTypeOf<FindPermissionsQuery | undefined>()
          return []
        },
        deletePermission: none,
        createRole: async ({ name, guardName, teamId }) => {
          expectTypeOf(teamId).toEqualTypeOf<TeamId>()
          return { id: 'uuid', name, guardName, teamId }
        },
        findRoles: async (query?: FindRolesQuery) => {
          expectTypeOf(query?.teamIds).toEqualTypeOf<readonly TeamId[] | undefined>()
          return []
        },
        deleteRole: none,
        getRolePermissionLinks: async (): Promise<RolePermissionLink[]> => [],
        attachRolePermissions: none,
        detachRolePermissions: async (_roleId, permissionIds) => {
          expectTypeOf(permissionIds).toEqualTypeOf<readonly Id[] | undefined>()
        },
        getSubjectRoleIds: async () => [],
        attachSubjectRoles: none,
        detachSubjectRoles: none,
        getSubjectPermissionIds: async () => [],
        attachSubjectPermissions: none,
        detachSubjectPermissions: none,
        getSubjectIdsWithRoles: async () => [],
        getSubjectIdsWithPermissions: async () => ['a', 2],
      }

      expectTypeOf<MemoryAdapter>().toExtend<RbacAdapter>()
      expectTypeOf<RbacAdapter['getSubjectRoleIds']>().parameters.toEqualTypeOf<[subject: Subject, teamId: TeamId]>()
      expectTypeOf<RbacAdapter['findRoles']>().returns.toEqualTypeOf<Promise<Role[]>>()

      const rbac = createRbac({ adapter })
      expect(await rbac.getRoles()).toEqual([])

      const typeOnly = (): void => {
        // @ts-expect-error methods must return promises
        const sync: Pick<RbacAdapter, 'findRoles'> = { findRoles: () => [] }
        void sync
      }
      expect(typeof typeOnly).toBe('function')
    })

    it('class adapters can extend MemoryAdapter', () => {
      class LoggingAdapter extends MemoryAdapter {
        override async deleteRole(id: Id): Promise<void> {
          await super.deleteRole(id)
        }
      }
      const rbac = createRbac({ adapter: new LoggingAdapter() })
      expectTypeOf(rbac.adapter).toEqualTypeOf<RbacAdapter>()
      expect(rbac.adapter).toBeInstanceOf(MemoryAdapter)
    })

    it('wildcard helpers', () => {
      expectTypeOf(parseWildcardPermission).toEqualTypeOf<(permission: string) => string[][]>()
      expectTypeOf(wildcardImplies).toEqualTypeOf<(granted: string, required: string) => boolean>()
      expect(wildcardImplies('articles.*', 'articles.edit')).toBe(true)
    })
  })
})

describe('RequirementArgs (typed guard arguments for integrations)', () => {
  type Opts = { any?: boolean | undefined }
  type Names = 'edit' | 'delete' | 'publish'
  const guard =
    <N extends string>() =>
    <const A extends readonly (RequirementNames | Opts)[]>(...args: A & RequirementArgs<A, N, Opts>): number =>
      args.length
  const typed = guard<Names>()
  const loose = guard<string>()

  it('accepts typed names, pipe lists, arrays and trailing options', () => {
    expect(typed('edit')).toBe(1)
    expect(typed('edit|delete', 'publish')).toBe(2)
    expect(typed('edit | delete')).toBe(1)
    expect(typed(['edit', 'delete'], { any: true })).toBe(2)
    expect(loose('anything|else', { any: true })).toBe(2)
    const spread: string[] = ['x']
    expect(typed(...spread)).toBe(1)
  })

  it('rejects unknown names, missing names and options that are not last', () => {
    void function neverCalled() {
      // @ts-expect-error typo
      typed('edti')
      // @ts-expect-error typo inside a pipe list
      typed('edit|delte')
      // @ts-expect-error typo inside an array
      typed(['edit', 'nope'])
      // @ts-expect-error no names
      typed()
      // @ts-expect-error no names, also without typed names
      loose()
      // @ts-expect-error options before a name
      loose({ any: true }, 'edit')
      // @ts-expect-error options without any name
      loose({ any: true })
    }
    expectTypeOf<CheckRequirementName<'edit|nope', Names>>().toEqualTypeOf<'edit|nope' & UnknownRequirementName<'nope'>>()
    expectTypeOf<CheckRequirementName<'edit|delete', Names>>().toEqualTypeOf<'edit|delete'>()
    expectTypeOf<CheckRequirementName<'whatever', string>>().toEqualTypeOf<'whatever'>()
  })
})
