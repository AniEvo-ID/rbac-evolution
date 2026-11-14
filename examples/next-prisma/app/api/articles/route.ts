import { prisma } from '@/lib/prisma'
import { withRbac } from '@/lib/rbac'

// GET /api/articles — 401 for guests, 403 without `view articles`.
export const GET = withRbac(
  async () => {
    const articles = await prisma.article.findMany({ where: { published: true }, orderBy: { id: 'asc' } })
    return Response.json(articles)
  },
  { permission: 'view articles' },
)
