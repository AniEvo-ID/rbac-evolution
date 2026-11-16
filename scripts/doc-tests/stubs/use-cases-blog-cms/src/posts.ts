// Stub: a copy of the `src/posts.ts` block of docs/use-cases/blog-cms.md.
import express from 'express'
import { asyncHandler } from '@anievo-id/rbac-evolution-express'
import { db } from './db'
import { canDeletePost, canEditPost } from './policies'
import { requirePermission } from './rbac'

export const posts = express.Router()

posts.post(
  '/',
  requirePermission('posts.create'),
  asyncHandler(async (req, res) => {
    const post = await db.posts.create({ authorId: req.user!.id, title: req.body.title })
    res.status(201).json(post)
  }),
)

posts.put(
  '/:id',
  requirePermission('posts.edit|posts.edit.own'), // any of them
  asyncHandler(async (req, res) => {
    const post = await db.posts.find(Number(req.params.id))
    if (!post) {
      res.sendStatus(404)
      return
    }
    if (!(await canEditPost(req.rbac!, post))) {
      res.sendStatus(403)
      return
    }
    res.json(await db.posts.update(post.id, { title: req.body.title }))
  }),
)

posts.post(
  '/:id/publish',
  requirePermission('posts.publish'),
  asyncHandler(async (req, res) => {
    res.json(await db.posts.update(Number(req.params.id), { status: 'published' }))
  }),
)

posts.delete(
  '/:id',
  requirePermission('posts.delete|posts.delete.own'),
  asyncHandler(async (req, res) => {
    const post = await db.posts.find(Number(req.params.id))
    if (!post) {
      res.sendStatus(404)
      return
    }
    if (!(await canDeletePost(req.rbac!, post))) {
      res.sendStatus(403)
      return
    }
    await db.posts.delete(post.id)
    res.sendStatus(204)
  }),
)
