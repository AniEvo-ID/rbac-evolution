import type { SubjectRbac } from '@anievo-id/rbac-evolution'
import { CurrentRbac } from '@anievo-id/rbac-evolution-nestjs'
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UnprocessableEntityException,
} from '@nestjs/common'
import type { Request } from 'express'
import { db } from './db'
import { type AppRbac, RequirePermissions, RequireRoleOrPermission } from './rbac'

const toJson = <A extends { published: number }>(a: A) => ({ ...a, published: a.published === 1 })

@Controller('api/articles')
export class ArticlesController {
  @Get()
  @RequirePermissions('view articles')
  async list(@CurrentRbac() access: SubjectRbac<AppRbac>) {
    // Only users who can publish see drafts.
    const showDrafts = await access.can('publish articles')
    let query = db.selectFrom('articles').selectAll().orderBy('id')
    if (!showDrafts) query = query.where('published', '=', 1)
    return (await query.execute()).map(toJson)
  }

  @Post()
  @RequirePermissions('create articles')
  async create(@Req() req: Request, @Body() body: { title?: unknown; body?: unknown }) {
    const title = String(body?.title ?? '').trim()
    if (!title) throw new UnprocessableEntityException({ error: 'TITLE_REQUIRED' })
    const article = await db
      .insertInto('articles')
      .values({ title, body: String(body?.body ?? ''), published: 0, author_id: req.user!.id })
      .returningAll()
      .executeTakeFirstOrThrow()
    return toJson(article)
  }

  /** A role OR a permission: admins, or anyone with `publish articles` (editors). */
  @Post(':id/publish')
  @HttpCode(200)
  @RequireRoleOrPermission('admin|publish articles')
  async publish(@Param('id', ParseIntPipe) id: number) {
    const article = await db
      .updateTable('articles')
      .set({ published: 1 })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst()
    if (!article) throw new NotFoundException({ error: 'NOT_FOUND' })
    return toJson(article)
  }

  @Delete(':id')
  @RequirePermissions('delete articles')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const { numDeletedRows } = await db.deleteFrom('articles').where('id', '=', id).executeTakeFirst()
    if (numDeletedRows === 0n) throw new NotFoundException({ error: 'NOT_FOUND' })
    return { deleted: id }
  }
}
