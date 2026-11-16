// `./db/schema` of "Table prefix".
import { pgRbacSchema } from '@anievo-id/rbac-evolution-drizzle/pg'

export const rbacTables = pgRbacSchema({ prefix: 'rbac_' })
