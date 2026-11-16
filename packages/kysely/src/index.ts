export { KyselyRbacAdapter, kyselyAdapter, type KyselyAdapterOptions } from './adapter'
export { detectDialect, type RbacDialect } from './dialect'
export {
  addRbacExpiryColumns,
  createRbacTables,
  dropRbacExpiryColumns,
  dropRbacTables,
  rbacExpiryMigration,
  rbacMigration,
  type RbacMigrationOptions,
} from './schema'
export {
  tableNames,
  type ModelHasPermissionsTable,
  type ModelHasRolesTable,
  type PermissionsTable,
  type RbacDatabase,
  type RbacTableNames,
  type RbacTableOptions,
  type RbacTimestamp,
  type RoleHasPermissionsTable,
  type RolesTable,
} from './tables'
