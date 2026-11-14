import type { Rbac, Subject, TeamId } from '@anievo-id/rbac-evolution'
import type { ExecutionContext, FactoryProvider, ModuleMetadata } from '@nestjs/common'

type MaybePromise<T> = T | Promise<T>

export interface RbacModuleOptions {
  /** The RBAC engine created with `createRbac(...)`. */
  rbac: Rbac
  /**
   * Resolves the authenticated subject for this execution context (e.g. from `request.user`).
   * Return `null` / `undefined` for guests.
   */
  getSubject: (context: ExecutionContext) => MaybePromise<Subject | null | undefined>
  /** RBAC guard name (e.g. `web` or `api`) — not a Nest guard. Defaults to the engine's `defaultGuard`. */
  guard?: string
  /** Resolves the current team (only when the engine was created with `teams: true`). */
  team?: (context: ExecutionContext) => MaybePromise<TeamId | undefined>
  /**
   * Include the required roles/permissions in the 403 body (`required`).
   * Default: `false` (like spatie's `display_permission_in_exception`).
   */
  exposeRequirements?: boolean
}

interface GlobalGuardOption {
  /**
   * Register `RbacGuard` as a global guard (`APP_GUARD`), so every route resolves the subject
   * (and `@CurrentRbac()` works without a `@Require*` decorator). Default: `false`.
   */
  globalGuard?: boolean
}

export interface RbacModuleConfig extends RbacModuleOptions, GlobalGuardOption {}

export interface RbacModuleAsyncConfig extends GlobalGuardOption, Pick<ModuleMetadata, 'imports'> {
  /** Providers to inject into `useFactory`. */
  inject?: FactoryProvider['inject']
  /** Builds the options, e.g. from a `ConfigService`. */
  useFactory: (...args: never[]) => MaybePromise<RbacModuleOptions>
}
