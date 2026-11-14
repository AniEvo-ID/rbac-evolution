import { router } from './router'
import { clearSession } from './session'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

/**
 * fetch() wrapper with the 401/403 handling the API's rbac guards call for:
 * - 401 UNAUTHENTICATED → drop the snapshot and go to /login
 * - 403 FORBIDDEN → throw ApiError(403) so the view can show the server's message
 */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? 'GET',
    headers: init.body === undefined ? {} : { 'content-type': 'application/json' },
    body: init.body === undefined ? null : JSON.stringify(init.body),
  })
  const data = res.status === 204 ? null : await res.json().catch(() => null)

  if (res.status === 401) {
    clearSession()
    await router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
    throw new ApiError(401, data?.message ?? 'Please log in.')
  }
  if (!res.ok) throw new ApiError(res.status, data?.message ?? data?.error ?? res.statusText)
  return data as T
}
