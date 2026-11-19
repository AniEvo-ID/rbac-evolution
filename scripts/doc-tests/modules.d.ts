// Doc tests (scripts/doc-tests.mjs): typed stand-ins for packages the docs import but the workspace
// doesn't install (or, for Prisma, doesn't generate). Only what the snippets use, with the real
// signatures. Everything else about them is out of scope: the doc tests check rbac-evolution's API.

declare module 'ioredis' {
  export class Redis {
    constructor(url?: string)
    get(key: string): Promise<string | null>
    call(command: string, ...args: (string | number)[]): Promise<unknown>
    set(key: string, value: string | number, mode: 'PX' | 'EX', ttl: number): Promise<'OK' | null>
    set(key: string, value: string | number): Promise<'OK'>
    del(...keys: string[]): Promise<number>
    scan(cursor: string | number, ...args: (string | number)[]): Promise<[cursor: string, keys: string[]]>
    unlink(...keys: string[]): Promise<number>
    publish(channel: string, message: string): Promise<number>
    subscribe(...channels: string[]): Promise<unknown>
    on(event: 'message', listener: (channel: string, message: string) => void): this
    quit(): Promise<'OK'>
  }
  export default Redis
}

/** better-sqlite3: a database Kysely's SqliteDialect accepts. */
declare module 'better-sqlite3' {
  import type { SqliteDatabase } from 'kysely'
  export default class Database implements SqliteDatabase {
    constructor(filename: string)
    close(): void
    prepare: SqliteDatabase['prepare']
  }
}

/** Vue single-file components. */
declare module '*.vue' {
  const component: import('vue').Component
  export default component
}

/** Vue Router 4, the parts the Vue guide's router guard uses. */
declare module 'vue-router' {
  export interface RouteMeta extends Record<string | number | symbol, unknown> {}
  export interface RouteRecordRaw {
    path: string
    component: import('vue').Component | (() => Promise<unknown>)
    meta?: RouteMeta
  }
  export interface RouteLocationNormalized {
    path: string
    meta: RouteMeta
  }
  export interface Router {
    install(app: import('vue').App): void
    beforeEach(guard: (to: RouteLocationNormalized, from: RouteLocationNormalized) => unknown): () => void
  }
  export interface RouterHistory {}
  export function createWebHistory(base?: string): RouterHistory
  export function createRouter(options: { history: RouterHistory; routes: RouteRecordRaw[] }): Router
}

/** Auth.js v5 (`next-auth@5`), the parts the Next.js guide and the Auth.js recipe use. */
declare module 'next-auth' {
  import type { JWT } from 'next-auth/jwt'
  export interface User {
    id?: string
    name?: string | null
    email?: string | null
    image?: string | null
  }
  export interface Session {
    user?: User
    expires: string
  }
  export interface NextAuthConfig {
    providers: unknown[]
    callbacks?: {
      signIn?(params: { user: User }): boolean | string | Promise<boolean | string>
      jwt?(params: { token: JWT; user: User }): JWT | null | Promise<JWT | null>
      session?(params: { session: Session & { user: User }; token: JWT }): Session | Promise<Session>
    }
  }
  export default function NextAuth(config: NextAuthConfig): {
    handlers: { GET(req: Request): Promise<Response>; POST(req: Request): Promise<Response> }
    auth(): Promise<Session | null>
    signIn(provider?: string, options?: object): Promise<void>
    signOut(options?: object): Promise<void>
  }
}

declare module 'next-auth/jwt' {
  export interface JWT {
    sub?: string
    [key: string]: unknown
  }
  export function getToken(params: { req: Request; secret?: string }): Promise<JWT | null>
}

/**
 * A generated Prisma client (the docs' schema: the five rbac models plus the app's own `user`,
 * `article`, ... models). The rbac delegates are typed like the real generated ones; app models are loose.
 */
declare module '@prisma/client' {
  type Delegate<Row> = {
    findMany(args?: { where?: object; orderBy?: object; select?: object; take?: number }): Promise<Row[]>
    findUnique(args: { where: object; select?: object; include?: object }): Promise<Row | null>
    findUniqueOrThrow(args: { where: object; select?: object; include?: object }): Promise<Row>
    findFirst(args?: { where?: object; select?: object }): Promise<Row | null>
    create(args: { data: object }): Promise<Row>
    createMany(args: { data: object[]; skipDuplicates?: boolean }): Promise<{ count: number }>
    update(args: { where: object; data: object }): Promise<Row>
    delete(args: { where: object }): Promise<Row>
    deleteMany(args?: { where?: object }): Promise<{ count: number }>
    groupBy(args: { by: (keyof Row)[]; where?: object }): Promise<Row[]>
  }
  type AppRow = Record<string, any>

  export class PrismaClient {
    constructor(options?: object)
    rbacPermission: Delegate<{ id: number; name: string; guardName: string }>
    rbacRole: Delegate<{ id: number; name: string; guardName: string; teamId: string }>
    rbacRoleHasPermission: Delegate<{ roleId: number; permissionId: number }>
    rbacModelHasRole: Delegate<{ roleId: number; subjectType: string; subjectId: string; teamId: string }>
    rbacModelHasPermission: Delegate<{ permissionId: number; subjectType: string; subjectId: string; teamId: string }>
    user: Delegate<AppRow>
    article: Delegate<AppRow>
    organization: Delegate<AppRow>
    team: Delegate<AppRow>
    membership: Delegate<AppRow>
    auditLog: Delegate<AppRow>
    invite: Delegate<AppRow>
    project: Delegate<AppRow>
    $transaction<P extends Promise<unknown>[]>(queries: [...P]): Promise<{ [K in keyof P]: Awaited<P[K]> }>
    $transaction<R>(fn: (tx: Omit<PrismaClient, '$transaction' | '$connect' | '$disconnect'>) => Promise<R>): Promise<R>
    $connect(): Promise<void>
    $disconnect(): Promise<void>
  }
}

/** `import 'dotenv/config'` (loads `.env`), as in a Prisma 7 `prisma.config.ts`. */
declare module 'dotenv/config' {}

/** Koa 2/3, the parts the Koa recipe uses. */
declare module 'koa' {
  export type Next = () => Promise<unknown>
  export interface Context {
    state: Record<string, any>
    status: number
    body: unknown
  }
  export type Middleware = (ctx: Context, next: Next) => unknown
  export default class Koa {
    use(middleware: Middleware): this
    listen(port: number): unknown
  }
}

/** @koa/router, the parts the Koa recipe uses. */
declare module '@koa/router' {
  import type { Middleware } from 'koa'
  export default class Router {
    get(path: string, ...middleware: Middleware[]): this
    patch(path: string, ...middleware: Middleware[]): this
    routes(): Middleware
  }
}

/** TanStack Start, the parts the TanStack Start guide uses (server functions and function middleware). */
declare module '@tanstack/react-start' {
  type Next = <C extends object>(options?: { context: C }) => Promise<{ context: C }>
  export interface FunctionMiddleware<C> {
    readonly '~context'?: C
  }
  export function createMiddleware(options?: { type?: 'function' | 'request' }): {
    server<C extends object>(
      fn: (options: { next: Next; request: Request; context: object }) => Promise<{ context: C }>,
    ): FunctionMiddleware<C>
  }
  interface ServerFnBuilder<D, C> {
    validator<V>(fn: (data: never) => V): ServerFnBuilder<V, C>
    middleware<M>(middleware: readonly FunctionMiddleware<M>[]): ServerFnBuilder<D, C & M>
    handler<R>(fn: (options: { data: D; context: C }) => R | Promise<R>): (options?: { data: D }) => Promise<Awaited<R>>
  }
  export function createServerFn(options?: { method?: 'GET' | 'POST' }): ServerFnBuilder<undefined, object>
}

declare module '@tanstack/react-start/server' {
  export function getRequest(): Request
}

/** TanStack Router, the parts the TanStack Start guide uses. */
declare module '@tanstack/react-router' {
  type Handler = (ctx: { request: Request; params: Record<string, string> }) => Response | Promise<Response>
  export function createFileRoute(path: string): (options: {
    server?: { handlers: Partial<Record<'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', Handler>> }
    beforeLoad?: () => unknown
  }) => unknown
  export function redirect(options: { to: string }): Response
}
