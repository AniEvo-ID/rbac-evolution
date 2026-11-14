import { NextResponse, type NextRequest } from 'next/server'
import { createRbacMiddleware } from '@anievo-id/rbac-evolution-next/middleware'
import { SESSION_COOKIE, parseUserId } from '@/lib/demo-auth'
import { rbac } from '@/lib/rbac-engine'

// First line of defence for page navigation. /admin/page.tsx still calls requireRole('admin').
const rbacMiddleware = createRbacMiddleware<NextRequest>({
  rbac,
  getSubject: (req) => {
    const id = parseUserId(req.cookies.get(SESSION_COOKIE)?.value)
    return id === null ? null : { type: 'user', id }
  },
  rules: [{ matcher: '/admin/:path*', role: 'admin' }],
  loginUrl: '/login',
  onUnauthorized: (req) => NextResponse.rewrite(new URL('/forbidden', req.url), { status: 403 }),
})

export async function middleware(req: NextRequest) {
  return (await rbacMiddleware(req)) ?? NextResponse.next()
}

// Prisma needs the Node.js middleware runtime (Next.js 15.5+).
export const config = {
  runtime: 'nodejs',
  matcher: ['/admin/:path*'],
}
