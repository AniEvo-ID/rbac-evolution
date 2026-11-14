import { createRbacPlugin, type RbacSnapshot } from '@anievo-id/rbac-evolution-vue'
import { reactive } from 'vue'

export interface SessionUser {
  id: number
  name: string
  email: string
}

/** UI-only checks (v-can, <Can>, router guards). The Express API enforces everything again. */
export const rbac = createRbacPlugin({ snapshot: null })

export const session = reactive<{ user: SessionUser | null; loaded: boolean }>({ user: null, loaded: false })

/** Loads `{ user, snapshot }` from GET /api/me and updates every v-can / <Can> on the page. */
export async function refreshSession(): Promise<void> {
  const res = await fetch('/api/me')
  const data = (await res.json()) as { user: SessionUser | null; snapshot: RbacSnapshot | null }
  session.user = data.user
  session.loaded = true
  rbac.setSnapshot(data.snapshot)
}

export function clearSession(): void {
  session.user = null
  rbac.setSnapshot(null)
}
