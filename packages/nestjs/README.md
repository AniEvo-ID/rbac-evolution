# @anievo-id/rbac-evolution-nestjs

NestJS integration for [RBAC Evolution](https://github.com/AniEvo-ID/rbac-evolution): a global `RbacModule`, an
`RbacGuard` and the `@RequirePermissions()`, `@RequireRoles()` and `@RequireRoleOrPermission()` decorators.

## Install

```bash
npm i @anievo-id/rbac-evolution @anievo-id/rbac-evolution-nestjs @nestjs/common @nestjs/core reflect-metadata
```

Works with NestJS 10, 11 and 12.

## Usage

```ts
import { Controller, Delete, Module } from '@nestjs/common'
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'
import { RbacModule, RequirePermissions } from '@anievo-id/rbac-evolution-nestjs'

const rbac = createRbac({ adapter: new MemoryAdapter() })

@Controller('articles')
class ArticlesController {
  @Delete(':id')
  @RequirePermissions('articles.delete') // 'a|b' = any of; several arguments = all of
  remove() {}
}

@Module({
  imports: [RbacModule.forRoot({ rbac, getSubject: (ctx) => toSubject(ctx.switchToHttp().getRequest().user) })],
  controllers: [ArticlesController],
})
export class AppModule {}
```

`toSubject` stands for your own code: return `{ type: 'user', id }` or `null` for guests.

- Guests get `UnauthorizedException`, users without access get `ForbiddenException` with
  `{ error, reason, message }`. `exposeRequirements: true` adds the required names. Leave it off in production.
- `createRbacDecorators<AppRbac>()` returns decorators that type-check names against your `createRbac<AppRbac>()`
  type.
- The package does not rely on `emitDecoratorMetadata`, so your app can build with `tsc`, SWC or esbuild.

## Documentation

https://creation.anievo.id/rbac-evolution/frameworks/nestjs

## License

MIT
