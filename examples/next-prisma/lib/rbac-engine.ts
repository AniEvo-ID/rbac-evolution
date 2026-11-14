import { createRbac } from '@anievo-id/rbac-evolution'
import { PrismaAdapter } from '@anievo-id/rbac-evolution-prisma'
import type { AppRbac } from './permissions'
import { prisma } from './prisma'

// The engine itself. This file has no Next.js imports, so it is shared by
// the app, middleware.ts, the seed script and rbac.config.ts (CLI).
export const rbac = createRbac<AppRbac>({
  adapter: new PrismaAdapter(prisma),
  // middleware.ts runs in its own module graph with its own engine instance, so an in-memory
  // cache there would not see role changes made from /admin. A shared store (Redis, ...)
  // would fix that; this demo simply reads from SQLite every time.
  cache: false,
})
