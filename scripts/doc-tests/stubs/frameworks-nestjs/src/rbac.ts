// `./rbac` of the NestJS guide (its examples use dotted names).
import { createRbac, MemoryAdapter } from '@anievo-id/rbac-evolution'

export type AppRbac = {
  permissions: 'articles.view' | 'articles.edit' | 'articles.publish' | 'articles.delete'
  roles: 'writer' | 'editor' | 'admin'
}

export const rbac = createRbac<AppRbac>({ adapter: new MemoryAdapter() })
