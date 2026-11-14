import { prisma } from '@/lib/prisma'
import { rbac } from '@/lib/rbac'
import { loginAs } from './actions'

export default async function LoginPage() {
  const users = await prisma.user.findMany({ orderBy: { id: 'asc' } })
  const withRoles = await Promise.all(
    users.map(async (user) => ({ ...user, roles: await rbac.for({ type: 'user', id: user.id }).getRoleNames() })),
  )

  return (
    <>
      <h1>Log in as…</h1>
      <p className="muted">Demo only: pick a seeded user. The choice is stored in a cookie.</p>
      {withRoles.map((user) => (
        <form key={user.id} action={loginAs} className="card row">
          <input type="hidden" name="userId" value={user.id} />
          <strong>{user.name}</strong>
          <span className="muted">{user.roles.join(', ') || 'no role'}</span>
          <button type="submit" style={{ marginLeft: 'auto' }}>
            Log in
          </button>
        </form>
      ))}
    </>
  )
}
