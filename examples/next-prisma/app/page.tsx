import Link from 'next/link'
import { getCurrentUser, getSnapshot } from '@/lib/rbac'

export default async function HomePage() {
  const user = await getCurrentUser()
  const snapshot = await getSnapshot()

  return (
    <>
      <h1>rbac-evolution · Next.js + Prisma</h1>
      <p>
        A tiny blog showing roles & permissions in the App Router. Pick a demo user on the{' '}
        <Link href="/login">login page</Link>, then visit <Link href="/articles">Articles</Link> and{' '}
        <Link href="/admin">Admin</Link>.
      </p>
      <h2>Your access</h2>
      {user ? (
        <ul>
          <li>User: {user.name}</li>
          <li>Roles: {snapshot.roles.join(', ') || '(none)'}</li>
          <li>Permissions: {snapshot.permissions.join(', ') || '(none)'}</li>
        </ul>
      ) : (
        <p className="muted">You are a guest.</p>
      )}
      <h2>Where to look</h2>
      <ul>
        <li><code>lib/rbac.ts</code> — <code>createNextRbac()</code> with a cookie-based demo session</li>
        <li><code>app/articles</code> — <code>&lt;Can&gt;</code> hides buttons, server actions use <code>withPermission()</code></li>
        <li><code>middleware.ts</code> + <code>app/admin/page.tsx</code> — <code>/admin</code> needs the admin role</li>
        <li><code>app/api/articles</code> — route handlers wrapped in <code>withRbac()</code></li>
      </ul>
    </>
  )
}
