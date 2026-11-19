import type { RbacDialect } from '@anievo-id/rbac-evolution-kysely'
import {
  type CompiledQuery,
  type DatabaseConnection,
  type DatabaseIntrospector,
  type Dialect,
  type DialectAdapter,
  type Driver,
  type Kysely,
  MssqlAdapter,
  MssqlIntrospector,
  MssqlQueryCompiler,
  MysqlAdapter,
  MysqlIntrospector,
  MysqlQueryCompiler,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type QueryCompiler,
  type QueryResult,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
} from 'kysely'

/** A Sequelize 6 transaction, structurally. */
export interface SequelizeTransaction {
  /** Set at runtime by Sequelize 6 (its typings leave it out). */
  readonly sequelize?: SequelizeInstance
  commit(): Promise<void>
  rollback(): Promise<void>
}

/** The part of a Sequelize 6 instance the adapter uses. */
export interface SequelizeInstance {
  getDialect(): string
  // `options` is `{ bind, type, raw, transaction? }`; typed loosely so Sequelize's overloads accept it.
  query(sql: string, options: object): Promise<unknown>
  transaction(options?: object): Promise<SequelizeTransaction>
}

export type SequelizeSource = SequelizeInstance | SequelizeTransaction

const DIALECTS: Record<string, RbacDialect> = {
  postgres: 'postgres',
  mysql: 'mysql',
  mariadb: 'mysql',
  sqlite: 'sqlite',
  mssql: 'mssql',
}

const isTransaction = (source: SequelizeSource): source is SequelizeTransaction =>
  typeof (source as SequelizeTransaction).commit === 'function'

/** The Sequelize instance of an instance or a transaction. */
export const sequelizeOf = (source: SequelizeSource): SequelizeInstance => {
  const instance = isTransaction(source) ? source.sequelize : source
  if (typeof instance?.query !== 'function') {
    throw new TypeError('rbac-evolution-sequelize: expected a Sequelize instance or transaction')
  }
  return instance
}

/** The rbac dialect of a Sequelize dialect (`sequelize.getDialect()`). */
export const dialectOf = (source: SequelizeSource): RbacDialect => {
  const name = sequelizeOf(source).getDialect()
  const dialect = DIALECTS[name]
  if (!dialect) {
    throw new Error(
      `rbac-evolution-sequelize: the "${name}" dialect is not supported (PostgreSQL, MySQL / MariaDB, SQLite and SQL Server are)`,
    )
  }
  return dialect
}

/**
 * Kysely's placeholders (`$1` on PostgreSQL, `?` on MySQL and SQLite, `@1` on SQL Server) as Sequelize bind
 * parameters (`$1`, `$2`, ...), which Sequelize turns into each driver's own. Compiled queries hold no literals with
 * these characters: every value is a parameter.
 */
export const toBindSql = (sql: string, dialect: RbacDialect): string => {
  if (dialect === 'postgres') return sql
  if (dialect === 'mssql') return sql.replace(/@(\d+)/g, '$$$1')
  let n = 0
  return sql.replace(/\?/g, () => `$${++n}`)
}

/**
 * Sequelize binds every SQL Server parameter that isn't a number, boolean or Buffer as NVarChar, which tedious rejects
 * for a Date. A UTC `YYYY-MM-DD HH:mm:ss.sss` string converts to the `datetime2` column whatever the DATEFORMAT, and
 * matches what tedious reads back (`useUTC`, its default and Sequelize's).
 */
const mssqlValue = (value: unknown): unknown =>
  value instanceof Date ? value.toISOString().replace('T', ' ').replace('Z', '') : value

type Kind = 'SELECT' | 'INSERT' | 'BULKDELETE' | 'BULKUPDATE' | 'RAW'

/**
 * The Sequelize query type that gives back what Kysely needs: the rows of a select (or of an INSERT with
 * RETURNING / OUTPUT), the insert id of a MySQL INSERT, the deleted row count of a DELETE.
 */
const kindOf = (compiled: CompiledQuery, dialect: RbacDialect): Kind => {
  const node = compiled.query as { kind: string; returning?: unknown; output?: unknown }
  if (node.kind === 'SelectQueryNode' || node.returning !== undefined || node.output !== undefined) return 'SELECT'
  if (node.kind === 'InsertQueryNode' && dialect === 'mysql') return 'INSERT'
  // SQL Server: Sequelize reads a BULKDELETE count from an `AFFECTEDROWS` column its own SQL adds, but a BULKUPDATE
  // count from the driver's row count, which a plain DELETE has too.
  if (node.kind === 'DeleteQueryNode') return dialect === 'mssql' ? 'BULKUPDATE' : 'BULKDELETE'
  return 'RAW'
}

class SequelizeConnection implements DatabaseConnection {
  transaction: SequelizeTransaction | undefined

  constructor(
    private readonly sequelize: SequelizeInstance,
    private readonly dialect: RbacDialect,
    /** The caller's transaction: the adapter joins it instead of starting one. */
    readonly joined: SequelizeTransaction | undefined,
  ) {
    this.transaction = joined
  }

  async executeQuery<R>(compiled: CompiledQuery): Promise<QueryResult<R>> {
    const type = kindOf(compiled, this.dialect)
    let sql = toBindSql(compiled.sql, this.dialect)
    // Sequelize's SQLite driver runs any SQL starting with `insert into` / `update` (after trimming) with sqlite3's
    // `run()`, which drops the rows of RETURNING. A leading comment makes it use `all()`, which returns them.
    if (type === 'SELECT' && this.dialect === 'sqlite' && compiled.query.kind !== 'SelectQueryNode') sql = `/* rows */ ${sql}`
    const result = await this.sequelize.query(sql, {
      bind: this.dialect === 'mssql' ? compiled.parameters.map(mssqlValue) : [...compiled.parameters],
      type,
      raw: true,
      ...(this.transaction ? { transaction: this.transaction } : {}),
    })
    if (type === 'SELECT') return { rows: result as R[] }
    if (type === 'INSERT') {
      const [insertId, affected] = result as [unknown, unknown]
      return {
        rows: [],
        ...(typeof insertId === 'number' ? { insertId: BigInt(insertId) } : {}),
        ...(typeof affected === 'number' ? { numAffectedRows: BigInt(affected) } : {}),
      }
    }
    if ((type === 'BULKDELETE' || type === 'BULKUPDATE') && typeof result === 'number') {
      return { rows: [], numAffectedRows: BigInt(result) }
    }
    return { rows: [] }
  }

  // eslint-disable-next-line require-yield
  async *streamQuery(): AsyncIterableIterator<QueryResult<never>> {
    throw new Error('rbac-evolution-sequelize: streaming is not supported')
  }
}

class SequelizeDriver implements Driver {
  constructor(
    private readonly source: SequelizeSource,
    private readonly dialect: RbacDialect,
  ) {}

  async init(): Promise<void> {}

  async acquireConnection(): Promise<DatabaseConnection> {
    const joined = isTransaction(this.source) ? this.source : undefined
    return new SequelizeConnection(sequelizeOf(this.source), this.dialect, joined)
  }

  async beginTransaction(connection: DatabaseConnection): Promise<void> {
    const c = connection as SequelizeConnection
    if (!c.joined) c.transaction = await sequelizeOf(this.source).transaction()
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    const c = connection as SequelizeConnection
    if (c.joined) return
    await c.transaction?.commit()
    c.transaction = undefined
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    const c = connection as SequelizeConnection
    if (c.joined) return
    await c.transaction?.rollback()
    c.transaction = undefined
  }

  async releaseConnection(): Promise<void> {}

  async destroy(): Promise<void> {}
}

const PARTS: Record<
  RbacDialect,
  {
    adapter: () => DialectAdapter
    compiler: () => QueryCompiler
    introspector: (db: Kysely<any>) => DatabaseIntrospector // eslint-disable-line @typescript-eslint/no-explicit-any
  }
> = {
  postgres: {
    adapter: () => new PostgresAdapter(),
    compiler: () => new PostgresQueryCompiler(),
    introspector: (db) => new PostgresIntrospector(db),
  },
  mysql: {
    adapter: () => new MysqlAdapter(),
    compiler: () => new MysqlQueryCompiler(),
    introspector: (db) => new MysqlIntrospector(db),
  },
  sqlite: {
    adapter: () => new SqliteAdapter(),
    compiler: () => new SqliteQueryCompiler(),
    introspector: (db) => new SqliteIntrospector(db),
  },
  mssql: {
    adapter: () => new MssqlAdapter(),
    compiler: () => new MssqlQueryCompiler(),
    introspector: (db) => new MssqlIntrospector(db),
  },
}

/**
 * A Kysely dialect that runs every query through `sequelize.query()`: on the pool, or in the caller's transaction
 * when given one (`sequelizeAdapter(t)` inside `sequelize.transaction(async (t) => ...)`).
 */
export function sequelizeDialect(source: SequelizeSource): Dialect {
  const dialect = dialectOf(source)
  const parts = PARTS[dialect]
  return {
    createAdapter: parts.adapter,
    createDriver: () => new SequelizeDriver(source, dialect),
    createQueryCompiler: parts.compiler,
    createIntrospector: parts.introspector,
  }
}
