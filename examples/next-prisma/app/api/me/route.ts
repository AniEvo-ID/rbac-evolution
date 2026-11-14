import { getCurrentUser, getSnapshot } from '@/lib/rbac'

// GET /api/me — who am I and what may I do? (guests: user null, empty snapshot)
export async function GET() {
  const user = await getCurrentUser()
  return Response.json({ user, snapshot: await getSnapshot() })
}
