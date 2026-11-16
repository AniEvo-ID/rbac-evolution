// `src/rbac.ts` of the Vue guide: the plugin, which is also the client-side RBAC instance.
import { createRbacPlugin } from '@anievo-id/rbac-evolution-vue'

export const rbac = createRbacPlugin({ wildcard: true, superAdminRoles: ['super-admin'] })
