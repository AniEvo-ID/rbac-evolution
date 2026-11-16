/**
 * @anievo-id/rbac-evolution-sveltekit
 *
 * Client side of the SvelteKit integration: the RBAC context (Svelte 5 runes), `<Can>` and `<HasRole>`.
 * Client-side checks are for UI only — enforce authorization on the server with
 * `@anievo-id/rbac-evolution-sveltekit/server`.
 */

import type { Component } from 'svelte'
import CanComponent from './Can.svelte'
import HasRoleComponent from './HasRole.svelte'
import type { CanProps, HasRoleProps } from './props.js'

export { createRbacChecker } from './checker.js'
export type { NameList, RbacChecker, RbacCheckerOptions } from './checker.js'

export { createRbacState, getRbacContext, RBAC_KEY, setRbacContext } from './context.svelte.js'
export type { RbacSnapshotSource, RbacStateOptions, SvelteRbac } from './context.svelte.js'

export type { CheckNames, TypesOf } from './types.js'
export type { CanProps, HasRoleProps } from './props.js'

// Typed through `CanProps` / `HasRoleProps`, so the declaration files (and the API reference) state the props
// without a `.svelte` type resolver.
/** Renders `children` when the user has the permission(s), otherwise the `fallback` snippet. See {@link CanProps}. */
export const Can: Component<CanProps> = CanComponent
/** Renders `children` when the user has the role(s), otherwise the `fallback` snippet. See {@link HasRoleProps}. */
export const HasRole: Component<HasRoleProps> = HasRoleComponent

export type { RbacSnapshot } from '@anievo-id/rbac-evolution'
