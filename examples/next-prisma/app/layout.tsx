import type { ReactNode } from 'react'
import Link from 'next/link'
import { HasRole, RbacProvider } from '@anievo-id/rbac-evolution-react'
import { getCurrentUser, getSnapshot, rbac } from '@/lib/rbac'
import { logout } from './login/actions'
import './globals.css'

export const metadata = { title: 'rbac-evolution · Next.js + Prisma example' }

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser()
  // Server-side snapshot of the user's roles & permissions; guests get an empty one.
  const snapshot = await getSnapshot()

  return (
    <html lang="en">
      <body>
        <RbacProvider snapshot={snapshot} wildcard={rbac.wildcard}>
          <header>
            <nav>
              <Link href="/">Home</Link>
              <Link href="/articles">Articles</Link>
              {/* Only admins see the link. The page itself is protected by middleware + requireRole(). */}
              <HasRole role="admin">
                <Link href="/admin">Admin</Link>
              </HasRole>
            </nav>
            <div>
              {user ? (
                <form action={logout}>
                  <span>
                    {user.name} <small>({snapshot.roles.join(', ') || 'no role'})</small>
                  </span>{' '}
                  <button type="submit">Log out</button>
                </form>
              ) : (
                <Link href="/login">Log in</Link>
              )}
            </div>
          </header>
          <main>{children}</main>
        </RbacProvider>
      </body>
    </html>
  )
}
