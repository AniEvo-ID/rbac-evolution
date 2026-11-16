import type { CheckRequirementName, Rbac, RbacTypeConfig } from '@anievo-id/rbac-evolution'

/** The type configuration of `T`: `T` itself, or the `X` of an `Rbac<X>` engine (`typeof rbac`). */
export type TypesOf<T> = T extends Rbac<infer X> ? X : T extends RbacTypeConfig ? T : never

/**
 * Checks a name, a `'a|b'` pipe list or an array of them against the names `N`.
 * Any name passes when `N` is `string` (an untyped engine).
 */
export type CheckNames<S, N extends string> = S extends string
  ? CheckRequirementName<S, N>
  : S extends readonly string[]
    ? { [K in keyof S]: S[K] extends string ? CheckRequirementName<S[K], N> : S[K] }
    : S
