import type { DefaultRbacTypes, Rbac, RbacTypeConfig, Subject, TeamId } from '@anievo-id/rbac-evolution'
import type { ExecutionContext, FactoryProvider, ModuleMetadata } from '@nestjs/common'

type MaybePromise<T> = T | Promise<T>

/**
 * `T` is the engine's names type (`createRbac<AppRbac>()`), inferred from `rbac`. Nest's parameter decorators
 * can't carry it to `@CurrentRbac()`: type the parameter as `SubjectRbac<AppRbac>` (see `createRbacDecorators`).
 */
export interface RbacModuleOptions<T extends RbacTypeConfig = DefaultRbacTypes> {
  /** The RBAC engine created with `createRbac(...)`. */
  rbac: Rbac<T>
  /**
   * Resolves the authenticated subject for this execution context (e.g. from `request.user`).
   * Return `null` / `undefined` for guests.
   */
  getSubject: (context: ExecutionContext) => MaybePromise<Subject | null | undefined>
  /** RBAC guard name (e.g. `web` or `api`) — not a Nest guard. Defaults to the engine's `defaultGuard`. */
  guard?: string | undefined
  /** Resolves the current team (only when the engine was created with `teams: true`). */
  team?: (context: ExecutionContext) => MaybePromise<TeamId | undefined>
  /**
   * Include the required roles/permissions in the 403 body (`required`).
   * Default: `false` (like spatie's `display_permission_in_exception`).
   */
  exposeRequirements?: boolean | undefined
}

interface GlobalGuardOption {
  /**
   * Register `RbacGuard` as a global guard (`APP_GUARD`), so every route resolves the subject
   * (and `@CurrentRbac()` works without a `@Require*` decorator). Default: `false`.
   */
  globalGuard?: boolean | undefined
}

export interface RbacModuleConfig<T extends RbacTypeConfig = DefaultRbacTypes>
  extends RbacModuleOptions<T>,
    GlobalGuardOption {}

export interface RbacModuleAsyncConfig<T extends RbacTypeConfig = DefaultRbacTypes>
  extends GlobalGuardOption,
    Pick<ModuleMetadata, 'imports'> {
  /** Providers to inject into `useFactory`. */
  inject?: FactoryProvider['inject'] | undefined
  /** Builds the options, e.g. from a `ConfigService`. */
  useFactory: (...args: never[]) => MaybePromise<RbacModuleOptions<T>>
}
