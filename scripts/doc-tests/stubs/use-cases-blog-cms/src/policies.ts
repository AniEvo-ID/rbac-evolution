// Stub: a copy of the `src/policies.ts` block of docs/use-cases/blog-cms.md.
import type { SubjectRbac } from '@anievo-id/rbac-evolution'
import type { Post } from './db'

/** Editors edit any post. Writers edit their own drafts. */
export async function canEditPost(access: SubjectRbac, post: Post): Promise<boolean> {
  if (await access.can('posts.edit')) return true
  const isAuthor = post.authorId === access.subject.id
  return isAuthor && post.status === 'draft' && (await access.can('posts.edit.own'))
}

/** Admins delete any post. Authors delete their own drafts. */
export async function canDeletePost(access: SubjectRbac, post: Post): Promise<boolean> {
  if (await access.can('posts.delete')) return true
  const isAuthor = post.authorId === access.subject.id
  return isAuthor && post.status === 'draft' && (await access.can('posts.delete.own'))
}
