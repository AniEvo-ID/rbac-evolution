// `./rbac`: the app's engine module, as the guides create it.
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'

/** The name types the framework guides pass to `createRbac<AppRbac>()` and `createGuards<AppRbac>()`. */
export type AppRbac = {
  permissions: 'view articles' | 'edit articles' | 'delete articles' | 'publish articles' | 'manage users'
  roles: 'writer' | 'editor' | 'admin'
}

export const rbac = createRbac({ adapter: new MemoryAdapter() })
