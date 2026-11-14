# @anievo-id/rbac-evolution-nestjs

NestJS integration for [rbac-evolution](../core): a global `RbacModule`, an `RbacGuard`, and the
`@RequirePermissions()`, `@RequireRoles()` and `@RequireRoleOrPermission()` decorators — the Nest counterpart of
spatie/laravel-permission's `permission`, `role` and `role_or_permission` middleware. Semantics and error bodies are
identical to [`@anievo-id/rbac-evolution-express`](../express).

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-nestjs
```

`@nestjs/common`, `@nestjs/core` (10, 11 or 12) and `reflect-metadata` are peer dependencies.

## Setup

```ts
import { Module } from '@nestjs/common'
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import { RbacModule } from '@anievo-id/rbac-evolution-nestjs'

const rbac = createRbac({ adapter: new MemoryAdapter() })

@Module({
  imports: [
    RbacModule.forRoot({
      rbac,
      // Return null / undefined for guests. Runs after your auth guard/middleware.
      getSubject: (ctx) => {
        const user = ctx.switchToHttp().getRequest().user
        return user ? { type: 'user', id: user.id } : null
      },
    }),
  ],
})
export class AppModule {}
```

Options: `rbac`, `getSubject(ctx)`, `guard` (RBAC guard name, e.g. `'api'`), `team(ctx)` (for `teams: true`),
`exposeRequirements` (add `required` to 403 bodies) and `globalGuard` (register `RbacGuard` as `APP_GUARD`).

`RbacModule.forRootAsync({ imports, inject, useFactory, globalGuard })` builds the options from other providers
(e.g. a `ConfigService`).

## Decorators

```ts
import { Controller, Delete, Get, Post } from '@nestjs/common'
import { CurrentRbac, RequirePermissions, RequireRoleOrPermission, RequireRoles } from '@anievo-id/rbac-evolution-nestjs'
import type { SubjectRbac } from '@anievo-id/rbac-evolution'

@Controller('articles')
export class ArticlesController {
  @Post()
  @RequirePermissions('articles.create')
  create() {}

  @Post(':id/publish')
  @RequirePermissions('articles.edit', 'articles.publish') // all of them
  publish() {}

  @Delete(':id')
  @RequirePermissions('articles.delete|articles.moderate') // any of them (also: { any: true })
  remove() {}

  @Get('drafts')
  @RequireRoles('editor|admin') // any; RequireRoles('a', 'b', { all: true }) for all
  drafts() {}

  @Get('stats')
  @RequireRoleOrPermission('admin|stats.view')
  stats(@CurrentRbac() rbac: SubjectRbac) {
    return rbac.snapshot()
  }
}
```

- Decorators work on controllers and handlers; class-level and handler-level requirements must **all** pass,
  and stacked decorators add up.
- Each decorator applies `@UseGuards(RbacGuard)` itself. `@CurrentRbac()` needs the guard to have run: use a
  `@Require*()` decorator, `@UseGuards(RbacGuard)`, or `globalGuard: true`.
- The `Rbac` engine is injectable with `@Inject(RBAC)`.

## Errors

| Situation      | Exception               | Body                                                     |
| -------------- | ----------------------- | -------------------------------------------------------- |
| No subject     | `UnauthorizedException` | `{ error: 'UNAUTHENTICATED', message }`                  |
| Missing access | `ForbiddenException`    | `{ error: 'FORBIDDEN', reason, message[, required] }`    |

`reason` is `'permission'`, `'role'` or `'role_or_permission'`. Customize the response with a Nest exception filter.

## Decorators & build tooling

The package is compiled with esbuild and does not rely on `emitDecoratorMetadata`: every injected dependency
uses an explicit `@Inject(token)`. Your app can use `tsc`, SWC or esbuild.
