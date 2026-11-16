// `lib/rbac.ts` of "3. Use it".
import { PrismaClient } from '@prisma/client'
import { createRbac } from '@anievo-id/rbac-evolution'
import { PrismaAdapter } from '@anievo-id/rbac-evolution-prisma'

export const prisma = new PrismaClient()
export const rbac = createRbac({ adapter: new PrismaAdapter(prisma) })
