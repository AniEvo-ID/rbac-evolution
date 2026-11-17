import type { SubjectRbac } from '@anievo-id/rbac-evolution'
import { CurrentRbac } from '@anievo-id/rbac-evolution-nestjs'
import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  Res,
  UnprocessableEntityException,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { db } from './db'
import { type AppRbac, ROLE_NAMES, RequireRoles, rbac } from './rbac'
import { SESSION_COOKIE, findUser } from './session'

async function usersWithRoles() {
  const users = await db.selectFrom('users').select(['id', 'name', 'email']).orderBy('id').execute()
  return Promise.all(users.map(async (u) => ({ ...u, roles: await rbac.for({ type: 'user', id: u.id }).getRoleNames() })))
}

/** Public routes: the demo users, log in / out, and the current user. No decorator, so the guard lets guests in. */
@Controller('api')
export class SessionController {
  @Get('users')
  users() {
    return usersWithRoles()
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { userId?: unknown }, @Res({ passthrough: true }) res: Response) {
    const user = await findUser(body?.userId)
    if (!user) throw new UnprocessableEntityException({ error: 'UNKNOWN_USER' })
    res.cookie(SESSION_COOKIE, String(user.id), { httpOnly: true, sameSite: 'lax', path: '/' })
    return { user }
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: '/' })
  }

  /** The current user and their snapshot (roles and permissions), e.g. for a UI to show or hide actions. */
  @Get('me')
  async me(@Req() req: Request, @CurrentRbac() access: SubjectRbac<AppRbac> | null) {
    return { user: req.user ?? null, snapshot: access ? await access.snapshot() : null }
  }
}

/** Every route of the controller needs the `admin` role. */
@Controller('api/admin/users')
@RequireRoles('admin')
export class AdminController {
  @Get()
  list() {
    return usersWithRoles()
  }

  /** Replaces the user's roles: `{ role: 'viewer' }`, or `{ role: null }` to remove every role. */
  @Put(':id/role')
  async setRole(@Param('id', ParseIntPipe) id: number, @Body() body: { role?: unknown }) {
    const user = await findUser(id)
    if (!user) throw new NotFoundException({ error: 'NOT_FOUND' })
    const role = ROLE_NAMES.find((name) => name === body?.role)
    await rbac.for({ type: 'user', id }).syncRoles(role ? [role] : [])
    return { id, roles: role ? [role] : [] }
  }
}
