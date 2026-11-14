# NestJS

`@anievo-id/rbac-evolution-nestjs` adds RBAC Evolution to NestJS apps: a global `RbacModule`, an `RbacGuard`, and
decorators — `@RequirePermissions()`, `@RequireRoles()` and `@RequireRoleOrPermission()` — that mirror
spatie/laravel-permission's `permission`, `role` and `role_or_permission` middleware. `@CurrentRbac()` injects the
current subject's `SubjectRbac` into a handler.

The semantics and the 401 / 403 bodies are the same as the [Express](/frameworks/express) package, so clients see
identical errors whichever backend they talk to. Works with **NestJS 10, 11 and 12**.

## Installation

::: code-group

```bash [npm]
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-nestjs
```

```bash [pnpm]
pnpm add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-nestjs
```

```bash [yarn]
yarn add @anievo-id/rbac-evolution @anievo-id/rbac-evolution-nestjs
```

:::

`@nestjs/common`, `@nestjs/core` and `reflect-metadata` are peer dependencies (every Nest app already has them).

## Setup

Authentication is up to you (Passport, a JWT guard, sessions, …). `RbacModule` only needs to know how to find the
subject in an `ExecutionContext`.

```ts
// app.module.ts
import { Module } from '@nestjs/common'
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import { RbacModule } from '@anievo-id/rbac-evolution-nestjs'
import { ArticlesController } from './articles.controller'

export const rbac = createRbac({ adapter: new MemoryAdapter() })

@Module({
  imports: [
    RbacModule.forRoot({
      rbac,
      // Return null or undefined for guests.
      getSubject: (ctx) => {
        const user = ctx.switchToHttp().getRequest().user
        return user ? { type: 'user', id: user.id } : null
      },
    }),
  ],
  controllers: [ArticlesController],
})
export class AppModule {}
```

`RbacModule` is a global module: register it once in the root module.

### Options

| Option               | Type                                                  | Description                                                                  |
| -------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| `rbac`               | `Rbac`                                                | Your `createRbac(...)` instance. **Required.**                               |
| `getSubject`         | `(ctx) => Subject \| null \| undefined \| Promise<…>` | Resolves the current subject. **Required.**                                  |
| `guard`              | `string`                                              | RBAC guard name (not a Nest guard). Defaults to the engine's `defaultGuard`. |
| `team`               | `(ctx) => TeamId \| undefined \| Promise<…>`          | Current team. Only for engines created with `teams: true`.                   |
| `exposeRequirements` | `boolean`                                             | Add the required names to 403 bodies (`required`). Default `false`.          |
| `globalGuard`        | `boolean`                                             | Register `RbacGuard` as `APP_GUARD` for every route. Default `false`.        |

### Async configuration

```ts
RbacModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    rbac,
    getSubject: (ctx) => {
      const user = ctx.switchToHttp().getRequest().user
      return user ? { type: 'user', id: user.id } : null
    },
    guard: config.get('RBAC_GUARD'),
  }),
  globalGuard: true,
})
```

`globalGuard` is a static option (it decides which providers the module registers), so it sits next to
`useFactory`, not inside it.

## Decorators

```ts
import { Controller, Delete, Get, Param, Post } from '@nestjs/common'
import type { SubjectRbac } from '@anievo-id/rbac-evolution'
import {
  CurrentRbac,
  RequirePermissions,
  RequireRoleOrPermission,
  RequireRoles,
} from '@anievo-id/rbac-evolution-nestjs'

@Controller('articles')
export class ArticlesController {
  @Post()
  @RequirePermissions('articles.create')
  create() {}

  @Delete(':id')
  @RequirePermissions('articles.delete|articles.moderate') // any of them
  remove(@Param('id') id: string) {}

  @Get('drafts')
  @RequireRoles('editor|admin')
  drafts() {}

  @Get('stats')
  @RequireRoleOrPermission('admin|stats.view')
  async stats(@CurrentRbac() rbac: SubjectRbac) {
    return { canExport: await rbac.can('stats.export') }
  }
}
```

### `@RequirePermissions(...names, options?)`

| Usage                                                     | Passes when the subject has… |
| --------------------------------------------------------- | ---------------------------- |
| `@RequirePermissions('articles.edit')`                    | the permission               |
| `@RequirePermissions('articles.edit\|articles.delete')`   | **any** of them (pipe)       |
| `@RequirePermissions('articles.edit', 'articles.publish')` | **all** of them              |
| `@RequirePermissions(['articles.edit', 'articles.publish'])` | **all** of them            |
| `@RequirePermissions('a', 'b', { any: true })`            | **any** of them              |
| `@CanAny('a', 'b')`                                       | **any** of them (spatie v8.5) |
| `@CanAll('a', 'b\|c')`                                     | **all** entries (spatie v8.5) |

Permission checks use `SubjectRbac.can()`, so `before` hooks, `superAdminRoles` and wildcards apply.

### `@RequireRoles(...names, options?)`

| Usage                                            | Passes when the subject has… |
| ------------------------------------------------ | ---------------------------- |
| `@RequireRoles('admin')`                         | the role                     |
| `@RequireRoles('admin\|editor')`                 | **any** of them              |
| `@RequireRoles('admin', 'editor')`               | **any** of them              |
| `@RequireRoles('admin', 'editor', { all: true })` | **all** of them             |

### `@RequireRoleOrPermission(...names)`

Passes when the subject has **any** of the names, either as a role or as a permission:
`@RequireRoleOrPermission('admin|articles.edit')`.

### Controllers, stacking and guards

- Decorators work on a controller class and on handlers. Every requirement must pass: class-level ones are
  checked first, then the handler's.
- Stacking decorators adds requirements (`@RequirePermissions('a')` + `@RequireRoles('editor')` = both).
- Each `@Require*()` decorator also applies `@UseGuards(RbacGuard)`, so nothing else has to be registered.
  With `globalGuard: true` the guard runs on every route; it resolves the subject only once per request either way.
- Declaring a decorator without any name throws a `TypeError` at startup.

## `@CurrentRbac()`

Injects the `SubjectRbac` that `RbacGuard` resolved — the same object as `rbac.for(subject, { guard, team })` — or
`null` for guests (only possible on routes without requirements).

```ts
@Get('me/permissions')
@UseGuards(RbacGuard) // or any @Require*() decorator, or globalGuard: true
async permissions(@CurrentRbac() rbac: SubjectRbac | null) {
  // Feed the React / Vue / Nuxt packages
  return rbac ? rbac.snapshot() : null
}
```

If the guard did not run for the route, `@CurrentRbac()` throws `RbacGuardMissingError` (a 500) instead of silently
returning `null`. Outside parameter decorators — in interceptors, for example — use `getRbac(executionContext)`.

## Error responses

| Situation                  | Exception               | Status | Body                                                             |
| -------------------------- | ----------------------- | ------ | ---------------------------------------------------------------- |
| No subject (guest)         | `UnauthorizedException` | 401    | `{ "error": "UNAUTHENTICATED", "message": "User is not logged in." }` |
| Missing permission/role    | `ForbiddenException`    | 403    | `{ "error": "FORBIDDEN", "reason": "permission", "message": "…" }` |

`reason` is `permission`, `role` or `role_or_permission`, with the same messages as spatie and the Express package.
Like spatie's `display_permission_in_exception`, the required names are hidden unless you set
`exposeRequirements: true`, which adds `required: string[][]` (groups: every group must pass, any name within a
group).

To render errors differently (an HTML page, a different JSON shape), use a regular Nest exception filter for
`UnauthorizedException` / `ForbiddenException`.

## Injecting the engine

The engine passed to `forRoot` is available under the `RBAC` token — handy for admin services that create roles or
assign permissions:

```ts
import { Inject, Injectable } from '@nestjs/common'
import type { Rbac } from '@anievo-id/rbac-evolution'
import { RBAC } from '@anievo-id/rbac-evolution-nestjs'

@Injectable()
export class RoleService {
  constructor(@Inject(RBAC) private readonly rbac: Rbac) {}

  promote(userId: number) {
    return this.rbac.for({ type: 'user', id: userId }).assignRole('editor')
  }
}
```

## Guards and teams

```ts
RbacModule.forRoot({
  rbac,
  getSubject: (ctx) => {
    const user = ctx.switchToHttp().getRequest().user
    return user ? { type: 'user', id: user.id } : null
  },
  guard: 'api',
  team: (ctx) => ctx.switchToHttp().getRequest().user?.teamId,
})
```

## Other transports

`RbacGuard` works for HTTP, microservices (`rpc`), WebSockets (`ws`) and GraphQL: the subject is cached per request
object (HTTP request, RPC context, WebSocket client or GraphQL context). Your `getSubject` decides where the user
comes from for each transport, e.g. `ctx.getType() === 'ws' ? ctx.switchToWs().getClient().user : …`.

## Decorator metadata

The package is built with esbuild and does not depend on `emitDecoratorMetadata`; its providers use explicit
`@Inject()` tokens. Your own app can use `tsc`, SWC or any other compiler Nest supports.

See also [Security](/best-practices/security).
