import {
  type CompiledQuery,
  type DatabaseConnection,
  DummyDriver,
  Kysely,
  MssqlAdapter,
  MssqlIntrospector,
  MssqlQueryCompiler,
  MysqlAdapter,
  MysqlIntrospector,
  MysqlQueryCompiler,
  type QueryResult,
} from 'kysely'
import { describe, expect, it } from 'vitest'
import { createRbacTables, kyselyAdapter } from '../src'

/** Runs nothing, like `DummyDriver`, but lets a test fail chosen queries the way the server would. */
class FailingDriver extends DummyDriver {
  constructor(private readonly fail: (query: CompiledQuery) => unknown) {
    super()
  }

  override async acquireConnection(): Promise<DatabaseConnection> {
    const fail = this.fail
    return {
      async executeQuery<R>(query: CompiledQuery): Promise<QueryResult<R>> {
        const error = fail(query)
        if (error !== undefined) throw error
        return { rows: [] }
      },
      streamQuery() {
        throw new Error('not supported')
      },
    }
  }
}

/** A Kysely instance that records the SQL it would send (failed queries included) instead of running it. */
function recorder(dialect: 'mysql' | 'mssql', fail: (query: CompiledQuery) => unknown = () => undefined) {
  const queries: string[] = []
  const parameters: (readonly unknown[])[] = []
  const db = new Kysely<any>({
    dialect: {
      createAdapter: () => (dialect === 'mysql' ? new MysqlAdapter() : new MssqlAdapter()),
      createDriver: () => new FailingDriver(fail),
      createIntrospector: (k) => (dialect === 'mysql' ? new MysqlIntrospector(k) : new MssqlIntrospector(k)),
      createQueryCompiler: () => (dialect === 'mysql' ? new MysqlQueryCompiler() : new MssqlQueryCompiler()),
    },
    log: (event) => {
      queries.push(event.query.sql)
      parameters.push(event.query.parameters)
    },
  })
  return { db, queries, parameters }
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
      'insert into "model_has_roles" ("role_id", "subject_type", "subject_id", "team_id") select @1 as "role_id", @2 as "subject_type", @3 as "subject_id", @4 as "team_id" where not exists (select 1 from "model_has_roles" as "e" where "e"."role_id" = @5 and "e"."subject_type" = @6 and "e"."subject_id" = @7 and "e"."team_id" = @8)',
    ])
  })

  describe('mssql: batched link inserts', () => {
    const subject = { type: 'user', id: 1 }
    const valueTuples = (query: string | undefined) => query?.match(/\(@\d+\)/g)?.length ?? 0
    const duplicate = (number: number) => Object.assign(new Error('duplicate key'), { number })

    it('inserts many links in one statement, binding the subject once', async () => {
      const { db, queries, parameters } = recorder('mssql')
      await kyselyAdapter(db).attachSubjectRoles(subject, [4, 5, 6], 'acme')
      expect(queries).toEqual([
        'insert into "model_has_roles" ("role_id", "subject_type", "subject_id", "team_id") select "v"."role_id", @1 as "subject_type", @2 as "subject_id", @3 as "team_id" from (values (@4), (@5), (@6)) as "v" ("role_id") where not exists (select 1 from "model_has_roles" as "e" where "e"."role_id" = "v"."role_id" and "e"."subject_type" = @7 and "e"."subject_id" = @8 and "e"."team_id" = @9)',
      ])
      expect(parameters).toEqual([['user', '1', 'acme', 4, 5, 6, 'user', '1', 'acme']])
    })

    it('batches role permissions with the role as the constant column', async () => {
      const { db, queries, parameters } = recorder('mssql')
      await kyselyAdapter(db, { prefix: 'app_' }).attachRolePermissions(1, [2, 3, 2])
      expect(queries).toEqual([
        'insert into "app_role_has_permissions" ("role_id", "permission_id") select @1 as "role_id", "v"."permission_id" from (values (@2), (@3)) as "v" ("permission_id") where not exists (select 1 from "app_role_has_permissions" as "e" where "e"."permission_id" = "v"."permission_id" and "e"."role_id" = @4)',
      ])
      expect(parameters).toEqual([[1, 2, 3, 1]])
    })

    it('splits at 1000 rows per VALUES list: 1001 links make 2 statements', async () => {
      const { db, queries, parameters } = recorder('mssql')
      const ids = Array.from({ length: 1001 }, (_, i) => i + 1)
      await kyselyAdapter(db).attachSubjectPermissions(subject, ids, null)
      expect(queries).toHaveLength(2)
      expect(queries.map(valueTuples)).toEqual([1000, 1])
      expect(queries[1]).toContain('from (values (@4)) as "v" ("permission_id") where not exists')
      expect(parameters.map((p) => p.length)).toEqual([1006, 7])
      expect(parameters.flatMap((p) => p.filter((v) => typeof v === 'number'))).toEqual(ids)
    })

    it('retries a chunk row by row after a duplicate-key error from a concurrent insert', async () => {
      const { db, queries } = recorder('mssql', (query) => {
        if (query.sql.includes('(values')) return duplicate(2627)
        // The row the concurrent insert added: its retry is a duplicate too, and is ignored.
        if (query.parameters[0] === 5) return duplicate(2601)
        return undefined
      })
      await kyselyAdapter(db).attachSubjectRoles(subject, [4, 5, 6], null)
      expect(queries).toHaveLength(4)
      expect(valueTuples(queries[0])).toBe(3)
      for (const query of queries.slice(1)) {
        expect(query).toMatch(/^insert into "model_has_roles" .* select @1 as "role_id", .* where not exists/)
        expect(query).not.toContain('values')
      }
    })

    it('still reports foreign-key and other errors, in the batch and in the retry', async () => {
      const foreignKey = Object.assign(new Error('conflicted with the FOREIGN KEY constraint'), { number: 547 })
      const batch = recorder('mssql', () => foreignKey)
      await expect(kyselyAdapter(batch.db).attachSubjectRoles(subject, [4, 5], null)).rejects.toBe(foreignKey)
      expect(batch.queries).toHaveLength(1)

      let calls = 0
      const retry = recorder('mssql', () => {
        calls += 1
        return calls === 1 ? duplicate(2627) : calls === 3 ? foreignKey : undefined
      })
      await expect(kyselyAdapter(retry.db).attachSubjectRoles(subject, [4, 5, 6], null)).rejects.toBe(foreignKey)
      expect(retry.queries).toHaveLength(3)
    })
  })
})
