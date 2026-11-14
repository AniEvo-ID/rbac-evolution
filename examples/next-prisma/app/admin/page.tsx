import { ROLE_NAMES, ROLES } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { rbac, requireRole } from '@/lib/rbac'
import { setUserRole } from './actions'

export default async function AdminPage() {
  // middleware.ts already blocks non-admins; this check protects the page on its own too.
  await requireRole('admin')

  const users = await prisma.user.findMany({ orderBy: { id: 'asc' } })
  const rows = await Promise.all(
    users.map(async (user) => ({ user, roles: await rbac.for({ type: 'user', id: user.id }).getRoleNames() })),
  )

  return (
    <>
      <h1>Admin</h1>
      <p className="muted">
        Protected twice: <code>middleware.ts</code> (role rule on <code>/admin/:path*</code>) and{' '}
        <code>requireRole(&apos;admin&apos;)</code> in this page.
      </p>

      <h2>Users</h2>
      <table>
        <thead>
          <tr>
            <th>User</th>
            <th>Roles</th>
            <th>Change role</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ user, roles }) => (
            <tr key={user.id}>
              <td>
                #{user.id} {user.name}
              </td>
              <td>{roles.join(', ') || <span className="muted">none</span>}</td>
              <td>
                <form action={setUserRole.bind(null, user.id)} className="row">
                  <select name="role" defaultValue={roles[0] ?? ''}>
                    <option value="">(no role)</option>
                    {ROLE_NAMES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <button type="submit">Save</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Roles</h2>
      <ul>
        {ROLE_NAMES.map((role) => (
          <li key={role}>
            <strong>{role}</strong>: {ROLES[role].join(', ')}
          </li>
        ))}
      </ul>
    </>
  )
}
