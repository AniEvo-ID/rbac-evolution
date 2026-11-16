// SvelteKit's `$lib` alias: `$lib/server/rbac` is the engine module of "Create the engine", and
// `$lib/server/guards` the guards of "Shared defaults". (A script file, so these declare the modules.)
declare module '$lib/server/rbac' {
  import type { Rbac } from '@anievo-id/rbac-evolution'

  export type AppRbac = {
    permissions: 'articles.edit' | 'articles.publish' | 'articles.delete' | 'billing.manage'
    roles: 'admin' | 'editor' | 'writer'
  }
  export const rbac: Rbac<AppRbac>
}

declare module '$lib/server/guards' {
  import type { Guards } from '@anievo-id/rbac-evolution-sveltekit/server'
  import type { AppRbac } from '$lib/server/rbac'

  export const requirePermission: Guards<AppRbac>['requirePermission']
  export const requireRole: Guards<AppRbac>['requireRole']
  export const requireRoleOrPermission: Guards<AppRbac>['requireRoleOrPermission']
  export const canAny: Guards<AppRbac>['canAny']
  export const canAll: Guards<AppRbac>['canAll']
}
