---
'@anievo-id/rbac-evolution': minor
'@anievo-id/rbac-evolution-prisma': minor
'@anievo-id/rbac-evolution-drizzle': minor
'@anievo-id/rbac-evolution-kysely': minor
'@anievo-id/rbac-evolution-mongoose': minor
---

Temporary access: optional expiry on role assignments and direct permissions.

- `assignRole()`, `givePermissionTo()`, `syncRoles()` and `syncPermissions()` take an optional last
  `{ expiresAt: Date | null }`. From `expiresAt` on, every check treats the link as absent: `can()`, `hasRole()`,
  `snapshot()`, `subjectsWithRole()` / `subjectsWithPermission()`, `teams()`, `revokeAll()` and `deleteTeam()`
  events. Expired rows stay in the database until `rbac.pruneExpired()` deletes them (no events).
- Re-assigning: the latest call wins (`assignRole()` without `expiresAt` makes the link permanent). `syncRoles()` /
  `syncPermissions()` without `expiresAt` keep the expiry of the links that stay.
- `rbac.for(subject).getRoleAssignments()` and `getDirectPermissionAssignments()` return each link with its
  `expiresAt`. `role.attached` / `permission.attached` (subject) payloads carry `expiresAt` with an expiry-enabled
  adapter, and are also emitted when a call changes the expiry of a held link.
- Cached subject states and `teams()` entries never outlive the earliest expiry inside them: the entry TTL is
  capped, and the state carries its `validUntil` for shared stores that round TTLs. New `createRbac({ now })`
  option to inject the engine clock (tests).
- **Opt-in per adapter, no schema change by default.** Expiry needs an `expires_at` column, so every adapter keeps
  the 1.1 behaviour (and never touches that column) unless created with `{ expiry: true }`:
  `new PrismaAdapter(prisma, { expiry: true })`, `drizzlePgAdapter(db, pgRbacSchema({ expiry: true }), { expiry: true })`,
  `kyselyAdapter(db, { expiry: true })`, `mongooseAdapter({ expiry: true })`, `new MemoryAdapter({ expiry: true })`.
  Giving an `expiresAt` to an adapter without it throws the new `RbacError` code `EXPIRY_NOT_SUPPORTED`, never
  granting permanent access.
- Migrations: an optional `expiresAt` field in `schema/rbac.prisma`; `sql/{pg,sqlite,mysql}-expiry.sql` and
  `{pg,sqlite,mysql}RbacSchema({ expiry: true })` for Drizzle; `addRbacExpiryColumns()`, `rbacExpiryMigration()`
  and `createRbacTables({ expiry: true })` for Kysely; an optional `expiresAt` field on the Mongoose link schemas
  (no migration). See each adapter's upgrade steps.
- `RbacAdapter` gets an optional `supportsExpiry` flag and three optional methods, `getSubjectRoleLinks()`,
  `getSubjectPermissionLinks()` and `deleteExpiredLinks()`; `attachSubject*()` and `getSubjectIdsWith*()` get an
  optional last argument that the engine only passes when `supportsExpiry` is `true`. Existing custom adapters keep
  working unchanged. The conformance suite runs its new expiry tests only for adapters that declare
  `supportsExpiry`.
