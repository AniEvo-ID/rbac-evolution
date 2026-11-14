import { prisma } from '@/lib/prisma'
import { withRbac } from '@/lib/rbac'

// DELETE /api/articles/:id — 401 for guests, 403 without `delete articles`.
export const DELETE = withRbac(
  async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const id = Number((await params).id)
    const { count } = await prisma.article.deleteMany({ where: { id } })
    if (count === 0) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
    return Response.json({ deleted: id })
  },
  { permission: 'delete articles' },
)
