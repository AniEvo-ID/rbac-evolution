import { type DynamicModule, Global, Module, type Provider } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { RbacGuard } from './guard'
import type { RbacModuleAsyncConfig, RbacModuleConfig, RbacModuleOptions } from './options'
import { RBAC, RBAC_MODULE_OPTIONS } from './tokens'

function build(optionsProvider: Provider, globalGuard: boolean, imports: DynamicModule['imports'] = []): DynamicModule {
  return {
    module: RbacModule,
    global: true,
    imports,
    providers: [
      optionsProvider,
      { provide: RBAC, useFactory: (options: RbacModuleOptions) => options.rbac, inject: [RBAC_MODULE_OPTIONS] },
      RbacGuard,
      ...(globalGuard ? [{ provide: APP_GUARD, useClass: RbacGuard }] : []),
    ],
    exports: [RBAC_MODULE_OPTIONS, RBAC, RbacGuard],
  }
}

/**
 * Registers rbac-evolution in a Nest application (global module).
 *
 * ```ts
 * @Module({
 *   imports: [
 *     RbacModule.forRoot({
 *       rbac,
 *       getSubject: (ctx) => {
 *         const user = ctx.switchToHttp().getRequest().user
 *         return user ? { type: 'user', id: user.id } : null
 *       },
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Global()
@Module({})
export class RbacModule {
  static forRoot(config: RbacModuleConfig): DynamicModule {
    const { globalGuard = false, ...options } = config
    return build({ provide: RBAC_MODULE_OPTIONS, useValue: options }, globalGuard)
  }

  /** Like {@link forRoot}, with options built by a factory (e.g. from a `ConfigService`). */
  static forRootAsync(config: RbacModuleAsyncConfig): DynamicModule {
    return build(
      { provide: RBAC_MODULE_OPTIONS, useFactory: config.useFactory, inject: config.inject ?? [] },
      config.globalGuard ?? false,
      config.imports ?? [],
    )
  }
}
