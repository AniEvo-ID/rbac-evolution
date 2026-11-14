'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, parseUserId } from '@/lib/demo-auth'

// Fake login: remember the chosen demo user in a cookie. No password, no auth provider.
export async function loginAs(formData: FormData) {
  const id = parseUserId(String(formData.get('userId')))
  if (id === null) redirect('/login')
  ;(await cookies()).set(SESSION_COOKIE, String(id), { httpOnly: true, sameSite: 'lax', path: '/' })
  redirect('/articles')
}

export async function logout() {
  ;(await cookies()).delete(SESSION_COOKIE)
  redirect('/login')
}
