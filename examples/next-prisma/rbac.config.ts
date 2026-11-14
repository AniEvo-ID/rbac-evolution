// Config for the rbac-evolution CLI: `pnpm rbac show`, `pnpm rbac assign-role editor 4`, ...
import { defineConfig } from '@anievo-id/rbac-evolution-cli'
import { prisma } from './lib/prisma'
import { rbac } from './lib/rbac-engine'

export default defineConfig({
  rbac: () => rbac,
  subjectType: 'user',
  teardown: () => prisma.$disconnect(),
})
