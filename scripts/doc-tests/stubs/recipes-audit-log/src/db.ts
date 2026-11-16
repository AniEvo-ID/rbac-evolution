// `./db`: "your own table" behind `db.auditLog` (a Prisma client here).
import { PrismaClient } from '@prisma/client'

export const db = new PrismaClient()
