import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'

// The SQLite file lives in prisma/dev.db (created by `pnpm db:setup`).
// Resolve it from the app folder so every entry point (Next, seed, CLI) uses the same file.
const url = process.env.DATABASE_URL ?? `file:${join(process.cwd(), 'prisma', 'dev.db')}`

// Reuse one client across hot reloads in `next dev`.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: url })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
