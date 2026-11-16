declare const rbac: Rbac
declare const adapter: RbacAdapter

/** The app's Kysely `Database` type of "Typing your `Database`". */
interface UsersTable {
  id: import('kysely').Generated<number>
  email: string
}
type RbacDatabase = import('@anievo-id/rbac-evolution-kysely').RbacDatabase
interface Database extends RbacDatabase {
  users: UsersTable
}
declare const db: import('kysely').Kysely<Database>
declare const yourMigrations: Record<string, import('kysely').Migration>
declare const createRbacTables: typeof import('@anievo-id/rbac-evolution-kysely').createRbacTables
declare const kyselyAdapter: typeof import('@anievo-id/rbac-evolution-kysely').kyselyAdapter
