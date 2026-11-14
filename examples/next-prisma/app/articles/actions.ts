'use server'

import { revalidatePath } from 'next/cache'
import { RbacUnauthorizedError } from '@anievo-id/rbac-evolution-next'
import { prisma } from '@/lib/prisma'
import { getSubject, withPermission } from '@/lib/rbac'

export type ActionResult = { ok: true; message: string } | { ok: false; error: string }

// withPermission() checks the user BEFORE the action body runs and throws RbacUnauthorizedError
// otherwise. <Can> only hides buttons; these guards are what actually protect the data.

const guardedCreate = withPermission('create articles', async (title: string, body: string) => {
  const subject = await getSubject()
  await prisma.article.create({ data: { title, body, authorId: Number(subject!.id) } })
})

const guardedPublish = withPermission('publish articles', async (id: number) => {
  await prisma.article.update({ where: { id }, data: { published: true } })
})

const guardedDelete = withPermission('delete articles', async (id: number) => {
  await prisma.article.delete({ where: { id } })
})

// Next.js hides error messages from the client in production, so the exported actions
// turn RbacUnauthorizedError into a plain result the UI can show.
async function run(work: () => Promise<void>, message: string): Promise<ActionResult> {
  try {
    await work()
  } catch (error) {
    if (error instanceof RbacUnauthorizedError) {
      return {
        ok: false,
        error: error.status === 401 ? '401: please log in first.' : '403: the server refused — you lack the permission.',
      }
    }
    throw error
  }
  revalidatePath('/articles')
  return { ok: true, message }
}

export async function createArticle(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const title = String(formData.get('title') ?? '').trim()
  const body = String(formData.get('body') ?? '').trim()
  if (!title) return { ok: false, error: 'Title is required.' }
  return run(() => guardedCreate(title, body), `Created “${title}”.`)
}

export async function publishArticle(id: number): Promise<ActionResult> {
  return run(() => guardedPublish(id), `Published article #${id}.`)
}

export async function deleteArticle(id: number): Promise<ActionResult> {
  return run(() => guardedDelete(id), `Deleted article #${id}.`)
}
