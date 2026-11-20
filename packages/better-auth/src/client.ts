import type { BetterAuthClientPlugin } from 'better-auth/client'
import type { rbacPlugin } from './index'

/**
 * Better Auth client plugin: `authClient.rbac.snapshot()` fetches the signed-in user's roles and permissions, for
 * `<RbacProvider>` of the React, Vue, Solid or SvelteKit package.
 *
 * ```ts
 * export const authClient = createAuthClient({ plugins: [rbacClient()] })
 * const { data: snapshot } = await authClient.rbac.snapshot()
 * ```
 */
export const rbacClient = () =>
  ({
    id: 'rbac',
    $InferServerPlugin: {} as ReturnType<typeof rbacPlugin>,
    pathMethods: { '/rbac/snapshot': 'GET' },
  }) satisfies BetterAuthClientPlugin
