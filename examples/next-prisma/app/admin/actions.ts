'use server'

import { revalidatePath } from 'next/cache'
import { ROLE_NAMES } from '@/lib/permissions'
import { rbac, withRole } from '@/lib/rbac'

const guardedSetRole = withRole('admin', async (userId: number, role: string) => {
  const user = rbac.for({ type: 'user', id: userId })
  const valid = ROLE_NAMES.find((name) => name === role)
  if (valid) await user.syncRoles(valid)
  else await user.syncRoles([])
})

/** Replaces a user's roles. Only admins may call it (withRole). */
export async function setUserRole(userId: number, formData: FormData): Promise<void> {
  await guardedSetRole(userId, String(formData.get('role') ?? ''))
  revalidatePath('/', 'layout')
}
