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

/** The part of a TypeORM `QueryRunner` the adapter uses (0.3 and 1.x). */
export interface TypeormQueryRunner {
  readonly isTransactionActive: boolean
  query(query: string, parameters?: unknown[], useStructuredResult?: true): Promise<unknown>
  startTransaction(): Promise<void>
  commitTransaction(): Promise<void>
  rollbackTransaction(): Promise<void>
  release(): Promise<void>
}

/** The part of a TypeORM `DataSource` the adapter uses (0.3 and 1.x). */
export interface TypeormDataSource {
  readonly options: { readonly type: string }
  createQueryRunner(): TypeormQueryRunner
}

/** The part of a TypeORM `EntityManager` the adapter uses: `dataSource` in 1.x, `connection` in 0.3. */
export interface TypeormEntityManager {
  readonly queryRunner?: TypeormQueryRunner | undefined
  readonly dataSource?: TypeormDataSource | undefined
  readonly connection?: TypeormDataSource | undefined
}

export type TypeormSource = TypeormDataSource | TypeormEntityManager

const DIALECTS: Record<string, RbacDialect> = {
  postgres: 'postgres',
  'aurora-postgres': 'postgres',
  cockroachdb: 'postgres',
  mysql: 'mysql',
  mariadb: 'mysql',
  'aurora-mysql': 'mysql',
  'better-sqlite3': 'sqlite',
  sqlite: 'sqlite',
  sqljs: 'sqlite',
  capacitor: 'sqlite',
  expo: 'sqlite',
  nativescript: 'sqlite',
  'react-native': 'sqlite',
  mssql: 'mssql',
}

const isDataSource = (source: TypeormSource): source is TypeormDataSource =>
  typeof (source as TypeormDataSource).createQueryRunner === 'function'

/** The DataSource of a DataSource or an EntityManager. */
export const dataSourceOf = (source: TypeormSource): TypeormDataSource => {
  if (isDataSource(source)) return source
  const ds = source.dataSource ?? source.connection
  if (!ds) throw new TypeError('rbac-evolution-typeorm: expected a TypeORM DataSource or EntityManager')
  return ds
}

/** The rbac dialect of a TypeORM driver type (`options.type`). */
export const dialectOf = (source: TypeormSource): RbacDialect => {
  const type = dataSourceOf(source).options.type
  const dialect = DIALECTS[type]
  if (!dialect) {
    throw new Error(
      `rbac-evolution-typeorm: the "${type}" driver is not supported (PostgreSQL, MySQL / MariaDB, SQLite and SQL Server are)`,
    )
  }
  return dialect
}

interface StructuredResult {
  records?: unknown[]
  affected?: number | null
  raw?: unknown
}

class TypeormConnection implements DatabaseConnection {
  constructor(
    readonly runner: TypeormQueryRunner,
    private readonly dialect: RbacDialect,
    /** Created by the driver, so released by it; a runner of the caller's EntityManager is not. */
    readonly owned: boolean,
    /** The caller's runner was already in a transaction: the adapter joins it instead of starting one. */
    readonly joined: boolean,
  ) {}

  async executeQuery<R>(compiled: CompiledQuery): Promise<QueryResult<R>> {
    let sql = compiled.sql
    // Kysely numbers SQL Server parameters from 1 (`@1`); TypeORM binds them by index from 0.
    if (this.dialect === 'mssql') sql = sql.replace(/@(\d+)/g, (_, n: string) => `@${Number(n) - 1}`)
    const result = (await this.runner.query(sql, [...compiled.parameters], true)) as StructuredResult
    const insertId = (result.raw as { insertId?: unknown } | null | undefined)?.insertId
    return {
      rows: (result.records ?? []) as R[],
      ...(typeof result.affected === 'number' ? { numAffectedRows: BigInt(result.affected) } : {}),
      ...(typeof insertId === 'number' || typeof insertId === 'bigint' ? { insertId: BigInt(insertId) } : {}),
    }
  }

  // eslint-disable-next-line require-yield
  async *streamQuery(): AsyncIterableIterator<QueryResult<never>> {
    throw new Error('rbac-evolution-typeorm: streaming is not supported')
  }
}

class TypeormDriver implements Driver {
  constructor(
    private readonly source: TypeormSource,
    private readonly dialect: RbacDialect,
  ) {}

  async init(): Promise<void> {}

  async acquireConnection(): Promise<DatabaseConnection> {
    const runner = isDataSource(this.source) ? undefined : this.source.queryRunner
    if (runner) return new TypeormConnection(runner, this.dialect, false, runner.isTransactionActive)
    return new TypeormConnection(dataSourceOf(this.source).createQueryRunner(), this.dialect, true, false)
  }

  async beginTransaction(connection: DatabaseConnection): Promise<void> {
    const c = connection as TypeormConnection
    if (!c.joined) await c.runner.startTransaction()
  }

  async commitTransaction(connection: DatabaseConnection): Promise<void> {
    const c = connection as TypeormConnection
    if (!c.joined) await c.runner.commitTransaction()
  }

  async rollbackTransaction(connection: DatabaseConnection): Promise<void> {
    const c = connection as TypeormConnection
    if (!c.joined) await c.runner.rollbackTransaction()
  }

  async releaseConnection(connection: DatabaseConnection): Promise<void> {
    const c = connection as TypeormConnection
    if (c.owned) await c.runner.release()
  }

  async destroy(): Promise<void> {}
}

const PARTS: Record<
  RbacDialect,
  {
    adapter: () => DialectAdapter
    compiler: () => QueryCompiler
    introspector: (db: Kysely<unknown>) => DatabaseIntrospector
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
 * A Kysely dialect that runs every query through TypeORM: the DataSource's pool, or the query runner of an
 * EntityManager (so it joins `dataSource.transaction(...)`).
 */
export function typeormDialect(source: TypeormSource): Dialect {
  const dialect = dialectOf(source)
  const parts = PARTS[dialect]
  return {
    createAdapter: parts.adapter,
    createDriver: () => new TypeormDriver(source, dialect),
    createQueryCompiler: parts.compiler,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createIntrospector: (db) => parts.introspector(db as Kysely<any>),
  }
}
