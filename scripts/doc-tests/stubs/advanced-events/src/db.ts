// "`db` and `auditLog` stand for your own database client and table": Drizzle here.
import { drizzle } from 'drizzle-orm/node-postgres'
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  action: text('action').notNull(),
  summary: text('summary').notNull(),
  teamId: text('team_id'),
  actorId: text('actor_id'),
  payload: text('payload').notNull(),
  createdAt: timestamp('created_at').notNull(),
})

export const db = drizzle(process.env.DATABASE_URL!)
