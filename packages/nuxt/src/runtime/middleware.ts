import { abortNavigation, createError, defineNuxtRouteMiddleware, navigateTo, useRuntimeConfig } from '#app'
import { useRbac } from './composables'
import { evaluateRouteRule, type RbacRouteRule } from './rule'
import type { RbacPublicConfig } from './types'

/**
 * Global route middleware: enforces `definePageMeta({ rbac: { ... } })` against the snapshot.
 * Guests go to `guestRedirect` / `unauthenticatedRedirect` (else a 401 error), users without
 * access to `redirect` / `forbiddenRedirect` (else a 403 error).
 */
export default defineNuxtRouteMiddleware((to) => {
  const rule = to.meta['rbac'] as RbacRouteRule | undefined
  if (!rule) return

  const rbac = useRbac()
  const result = evaluateRouteRule(rbac, rule, rbac.isGuest())
  if (result.ok) return

  const config = (useRuntimeConfig().public['rbac'] ?? {}) as Partial<RbacPublicConfig>
  const redirect =
    result.status === 401
      ? (rule.guestRedirect ?? config.unauthenticatedRedirect)
      : (rule.redirect ?? config.forbiddenRedirect)
  if (redirect && redirect !== to.path) return navigateTo(redirect)

  return abortNavigation(
    createError({
      statusCode: result.status,
      statusMessage: result.status === 401 ? 'Unauthorized' : 'Forbidden',
      data:
        result.status === 401
          ? { error: result.error, message: 'User is not logged in.' }
          : { error: result.error, reason: result.reason, message: result.message },
    }),
  )
})
