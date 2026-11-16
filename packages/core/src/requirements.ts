import type { GuardOptions, SubjectRbac } from './rbac'
import type { DefaultGuardName, DefaultRbacTypes, GuardName, PermissionName, RbacTypeConfig, RoleName } from './types'

/**
 * Shared requirement logic for the framework integrations (spatie's `permission:`, `role:` and
 * `role_or_permission:` middleware), so every package parses names and checks them the same way.
 */

/** Which kind of requirement a guard checks. */
export type RequirementKind = 'permission' | 'role' | 'role_or_permission'

/** A name, a pipe-separated list (`'edit|delete'` = any of), or an array of names. */
export type RequirementNames = string | readonly string[]

// ---------------------------------------------------------------------------- typed guard arguments
//
// Types for integrations whose guards take `(...names, options?)`, like `requirePermission('a|b', 'c', { any: true })`.
// With typed names (see `RbacTypeConfig`), every name, including each part of a pipe list, must be one of `N`.
// Without them (`N` is `string`), any name is accepted. In both cases a call with no names, or with options
// before the last argument, is a type error, because it would throw (or ignore the options) at runtime.

type TrimSpaces<S extends string> = S extends ` ${infer R}` ? TrimSpaces<R> : S extends `${infer L} ` ? TrimSpaces<L> : S

/** The first `|`-separated part of `S` that is not in `N`, or `never` when every part is. */
type UnknownPart<S extends string, N extends string> = S extends `${infer A}|${infer B}`
  ? TrimSpaces<A> extends N
    ? UnknownPart<B, N>
    : TrimSpaces<A>
  : TrimSpaces<S> extends N
    ? never
    : TrimSpaces<S>

/** Shown in the type error when a name is not one of the typed names. */
export interface UnknownRequirementName<S extends string> {
  'rbac-evolution: unknown name': S
}

/** Shown in the type error when an options object is not the last argument. */
export interface OptionsMustBeLast {
  'rbac-evolution: options must be the last argument': true
}

/** Shown in the type error when a guard gets no names. */
export interface NamesRequired {
  'rbac-evolution: at least one name is required': true
}

/** `S` when every part of the pipe list `S` is in `N` (always, for plain `string` names), else an error type. */
export type CheckRequirementName<S extends string, N extends string> = string extends N
  ? S
  : string extends S
    ? S
    : [UnknownPart<S, N>] extends [never]
      ? S
      : S & UnknownRequirementName<UnknownPart<S, N>>

type CheckNames<X, N extends string> = X extends string
  ? CheckRequirementName<X, N>
  : X extends readonly string[]
    ? { [K in keyof X]: X[K] extends string ? CheckRequirementName<X[K], N> : X[K] }
    : OptionsMustBeLast

/**
 * Validates a guard's `(...names, options?)` arguments `A` against the names `N` and the options type `O`.
 * Use it as `fn<const A extends readonly (RequirementNames | O)[]>(...args: A & RequirementArgs<A, N, O>)`.
 * Arguments that are not a fixed tuple (a spread `string[]`) are not checked.
 */
export type RequirementArgs<A extends readonly unknown[], N extends string, O> = number extends A['length']
  ? A
  : A extends readonly []
    ? [names: NamesRequired]
    : A extends readonly [...infer Init, infer Last]
      ? Last extends RequirementNames
        ? { [K in keyof A]: CheckNames<A[K], N> }
        : Init extends readonly []
          ? [names: NamesRequired, options: O]
          : [...{ [K in keyof Init]: CheckNames<Init[K], N> }, O]
      : A

// ------------------------------------------------------------------------------- per-guard names
//
// With per-guard names (`RbacTypeConfig['guards']`), the names a guard accepts depend on the auth guard it checks
// in: its `{ guard }` option when given, else the guard of the request. The integrations build their typed
// guards from these.

/** The names a requirement of kind `K` accepts in guard `G` of `T`. */
export type RequirementName<
  T extends RbacTypeConfig = DefaultRbacTypes,
  K extends RequirementKind = RequirementKind,
  G extends string = DefaultGuardName<T>,
> = K extends 'permission'
  ? PermissionName<T, G>
  : K extends 'role'
    ? RoleName<T, G>
    : PermissionName<T, G> | RoleName<T, G>

/**
 * The guard named by the trailing options of guard arguments `A` (`requirePermission('a', { guard: 'api' })`
 * gives `'api'`), or `G` when there is none.
 */
export type RequirementGuard<A extends readonly unknown[], G extends string> = A extends readonly [
  ...unknown[],
  infer Last,
]
  ? Last extends { readonly guard: infer X extends string }
    ? X
    : G
  : G

/** Shown in the type error when a guard's `guard` option is not one of the typed guards. */
export interface UnknownGuardName<G extends string> {
  'rbac-evolution: unknown guard': G
}

/** `G` when it is one of the typed guards of `T` (or any `string`), else an error type naming it. */
export type CheckRequirementGuard<T extends RbacTypeConfig, G extends string> = string extends G
  ? string
  : G extends GuardName<T>
    ? G
    : G & UnknownGuardName<G>

/**
 * {@link RequirementArgs} with per-guard names: the names of kind `K` are those of the guard the call checks in
 * ({@link RequirementGuard}: the options' `guard`, else `G`), and `guard` must be one of the typed guards (or
 * any string, which accepts the names of every guard). Without `guards` in `T`, the same as
 * `RequirementArgs<A, RequirementName<T, K>, O>`.
 */
export type GuardRequirementArgs<
  A extends readonly unknown[],
  T extends RbacTypeConfig,
  K extends RequirementKind,
  G extends string,
  O,
> = RequirementArgs<
  A,
  RequirementName<T, K, RequirementGuard<A, G>>,
  O & GuardOptions<CheckRequirementGuard<T, RequirementGuard<A, G>>>
>

/** A normalized requirement. Every group must pass; a group passes when ANY of its names matches. */
export interface RbacRequirement {
  kind: RequirementKind
  requirements: string[][]
}

export interface PermissionRequirementOptions {
  /** Pass when the subject has ANY of the permissions (instead of all). Default: `false`. */
  any?: boolean | undefined
}

export interface RoleRequirementOptions {
  /** Require ALL of the roles (instead of any). Default: `false`. */
  all?: boolean | undefined
}

/** Default 403 messages, per kind (same wording as spatie). */
export const REQUIREMENT_MESSAGES: Readonly<Record<RequirementKind, string>> = {
  permission: 'User does not have the right permissions.',
  role: 'User does not have the right roles.',
  role_or_permission: 'User does not have any of the necessary access rights.',
}

/** Default 401 message. */
export const UNAUTHENTICATED_MESSAGE = 'User is not logged in.'

const split = (name: string): string[] =>
  name
    .split('|')
    .map((n) => n.trim())
    .filter((n) => n !== '')

/** Each argument is a group (pipes = any within the group); arrays contribute one group per item. */
function toGroups(names: readonly RequirementNames[]): string[][] {
  const groups: string[][] = []
  for (const name of names) {
    for (const item of typeof name === 'string' ? [name] : name) {
      const group = split(item)
      if (group.length > 0) groups.push(group)
    }
  }
  return groups
}

function ensure(requirement: RbacRequirement): RbacRequirement {
  const { requirements } = requirement
  if (requirements.length === 0 || requirements.some((group) => group.length === 0)) {
    throw new TypeError(`[rbac-evolution] A ${requirement.kind} requirement needs at least one name.`)
  }
  return requirement
}

/** Splits `(...names, options?)` guard arguments: a trailing plain object is the options. */
export function splitRequirementArgs<O extends object>(
  args: readonly (RequirementNames | O)[],
): { names: RequirementNames[]; options: O | undefined } {
  const last = args[args.length - 1]
  if (last !== undefined && typeof last === 'object' && !Array.isArray(last)) {
    return { names: args.slice(0, -1) as RequirementNames[], options: last as O }
  }
  return { names: args as RequirementNames[], options: undefined }
}

/** `'a', 'b'` = all; `'a|b'` = any; `{ any: true }` = any of everything. Throws `TypeError` without names. */
export function permissionRequirement(
  names: readonly RequirementNames[],
  options: PermissionRequirementOptions = {},
): RbacRequirement {
  const groups = toGroups(names)
  return ensure({ kind: 'permission', requirements: options.any ? [groups.flat()] : groups })
}

/** Any of the roles by default; `{ all: true }` = all of them. Throws `TypeError` without names. */
export function roleRequirement(names: readonly RequirementNames[], options: RoleRequirementOptions = {}): RbacRequirement {
  const all = toGroups(names).flat()
  return ensure({ kind: 'role', requirements: options.all ? all.map((r) => [r]) : [all] })
}

/** Any of the names, as a role OR as a permission. Throws `TypeError` without names. */
export function roleOrPermissionRequirement(names: readonly RequirementNames[]): RbacRequirement {
  return ensure({ kind: 'role_or_permission', requirements: [toGroups(names).flat()] })
}

/** `true` when every group of the requirement passes for the subject. */
export async function satisfiesRequirement(rbac: SubjectRbac, requirement: RbacRequirement): Promise<boolean> {
  for (const group of requirement.requirements) {
    let pass: boolean
    switch (requirement.kind) {
      case 'permission':
        pass = await rbac.canAny(group)
        break
      case 'role':
        pass = await rbac.hasAnyRole(group)
        break
      default:
        pass = (await rbac.hasAnyRole(group)) || (await rbac.canAny(group))
    }
    if (!pass) return false
  }
  return true
}
