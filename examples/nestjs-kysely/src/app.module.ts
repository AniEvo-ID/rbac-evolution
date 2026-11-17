import type { Subject } from '@anievo-id/rbac-evolution'
import { RbacModule } from '@anievo-id/rbac-evolution-nestjs'
import { Module } from '@nestjs/common'
import type { Request } from 'express'
import { ArticlesController } from './articles.controller'
import { rbac } from './rbac'
import { AdminController, SessionController } from './users.controller'

@Module({
  imports: [
    RbacModule.forRoot({
      rbac,
      // req.user comes from the session middleware (main.ts); guests are null.
      getSubject: (ctx): Subject | null => {
        const user = ctx.switchToHttp().getRequest<Request>().user
        return user ? { type: 'user', id: user.id } : null
      },
      // RbacGuard on every route: routes without a decorator stay public, and @CurrentRbac() works everywhere.
      globalGuard: true,
    }),
  ],
  controllers: [SessionController, ArticlesController, AdminController],
})
export class AppModule {}
