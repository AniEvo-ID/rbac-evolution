import {
  DummyDriver,
  Kysely,
  MssqlAdapter,
  MssqlIntrospector,
  MssqlQueryCompiler,
  MysqlAdapter,
  MysqlIntrospector,
  MysqlQueryCompiler,
} from 'kysely'
import { describe, expect, it } from 'vitest'
import { createRbacTables, kyselyAdapter } from '../src'

/** A Kysely instance that records the SQL it would send instead of running it. */
function recorder(dialect: 'mysql' | 'mssql') {
  const queries: string[] = []
  const db = new Kysely<any>({
    dialect: {
      createAdapter: () => (dialect === 'mysql' ? new MysqlAdapter() : new MssqlAdapter()),
      createDriver: () => new DummyDriver(),
      createIntrospector: (k) => (dialect === 'mysql' ? new MysqlIntrospector(k) : new MssqlIntrospector(k)),
      createQueryCompiler: () => (dialect === 'mysql' ? new MysqlQueryCompiler() : new MssqlQueryCompiler()),
    },
    log: (event) => {
      if (event.level === 'query') queries.push(event.query.sql)
    },
  })
  return { db, queries }
}

// MySQL and SQL Server run against real servers only in CI (MYSQL_URL) or not at all (SQL Server);
// these checks pin down the SQL the dialect-specific code paths generate.
describe('kysely: generated SQL', () => {
  it('mysql: binary-collated varchar columns and no-op ON DUPLICATE KEY UPDATE', async () => {
    const { db, queries } = recorder('mysql')
    await createRbacTables(db)
    const ddl = queries.join('\n')
    expect(ddl).toContain('varchar(255) character set utf8mb4 collate utf8mb4_bin')
    expect(ddl).toContain('auto_increment')
    expect(ddl).toContain('on delete cascade')

    queries.length = 0
    const adapter = kyselyAdapter(db)
    expect(adapter.dialect).toBe('mysql')
    await adapter.attachRolePermissions(1, [2, 3])
    expect(queries.at(-1)).toBe(
      'insert into `role_has_permissions` (`role_id`, `permission_id`) values (?, ?), (?, ?) on duplicate key update `role_id` = `role_id`',
    )
  })

  it('mssql: identity ids, OUTPUT for inserted ids and insert-where-not-exists links', async () => {
    const { db, queries } = recorder('mssql')
    await createRbacTables(db)
    const ddl = queries.join('\n')
    expect(ddl).toContain('identity')
    expect(ddl).toContain('nvarchar(255) collate Latin1_General_100_BIN2')
    expect(ddl).not.toContain('if not exists')

    queries.length = 0
    const adapter = kyselyAdapter(db)
    expect(adapter.dialect).toBe('mssql')
    await expect(adapter.createPermission({ name: 'edit', guardName: 'web' })).rejects.toThrow(/returned no id/)
    expect(queries.at(-1)).toBe('insert into "permissions" ("name", "guard_name") output "inserted"."id" values (@1, @2)')

    queries.length = 0
    await adapter.attachSubjectRoles({ type: 'user', id: 1 }, [4], null)
    expect(queries).toEqual([
      'insert into "model_has_roles" ("role_id", "subject_type", "subject_id", "team_id") select @1 as "role_id", @2 as "subject_type", @3 as "subject_id", @4 as "team_id" where not exists (select 1 as "one" from "model_has_roles" where ("role_id" = @5 and "subject_type" = @6 and "subject_id" = @7 and "team_id" = @8))',
    ])
  })
})
