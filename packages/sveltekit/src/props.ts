import type { Snippet } from 'svelte'
import type { NameList } from './checker.js'

/**
 * Props of `<Can>`. Conditions are ANDed; without any condition nothing passes (deny by default).
 *
 * ```svelte
 * <Can permission="articles.edit">...</Can>
 * <Can anyOf={['articles.edit', 'articles.delete']}>
 *   ...
 *   {#snippet fallback()}No access{/snippet}
 * </Can>
 * ```
 */
export interface CanProps {
  /** The permission, or a list of permissions that are ALL required. */
  permission?: NameList | undefined
  /** Passes with ANY of these permissions. */
  anyOf?: NameList | undefined
  /** Passes with ALL of these permissions. */
  allOf?: NameList | undefined
  /** Invert the check (render `children` when the user does NOT have the permissions). */
  not?: boolean | undefined
  children?: Snippet | undefined
  /** Rendered when the check fails. */
  fallback?: Snippet | undefined
}

/**
 * Props of `<HasRole>`. Conditions are ANDed; without any condition nothing passes (deny by default).
 *
 * ```svelte
 * <HasRole role="admin|editor">...</HasRole>
 * <HasRole allOf={['writer', 'editor']}>...</HasRole>
 * ```
 */
export interface HasRoleProps {
  /** The role, or ANY of the roles (`'writer|editor'` or a list). */
  role?: NameList | undefined
  /** Passes with ANY of these roles. */
  anyOf?: NameList | undefined
  /** Passes with ALL of these roles. */
  allOf?: NameList | undefined
  /** Invert the check (render `children` when the user does NOT have the roles). */
  not?: boolean | undefined
  children?: Snippet | undefined
  /** Rendered when the check fails. */
  fallback?: Snippet | undefined
}
