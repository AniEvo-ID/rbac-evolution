// tRPC guide: `t` and the procedures are those of "Setup" (`@/server/trpc`), the guards are the package's.
type User = { id: string }
type Article = { id: string; title: string; authorId: string }
type Context = import('../server/trpc').Context
declare const rbac: Rbac
declare const adapter: RbacAdapter
/** "your auth": reads the user from the request (a session cookie, a JWT, ...). */
declare function getUser(req: Request): Promise<User | null>
/** The same, from the headers of a Server Component or Server Action. */
declare function getUserFromHeaders(headers: Headers): Promise<User | null>
declare const db: {
  articles: {
    list(): Promise<Article[]>
    find(id: string): Promise<Article>
    update(id: string, data: { title: string }): Promise<Article>
  }
  stats(): Promise<{ users: number }>
}

declare const t: typeof import('../server/trpc').t
declare const router: typeof import('../server/trpc').router
declare const publicProcedure: typeof import('../server/trpc').publicProcedure

declare const TRPCError: typeof import('@trpc/server').TRPCError
declare const createRbacContext: typeof import('@anievo-id/rbac-evolution-trpc').createRbacContext
declare const requirePermission: typeof import('@anievo-id/rbac-evolution-trpc').requirePermission
declare const requireRole: typeof import('@anievo-id/rbac-evolution-trpc').requireRole
declare const requireRoleOrPermission: typeof import('@anievo-id/rbac-evolution-trpc').requireRoleOrPermission
declare const canAny: typeof import('@anievo-id/rbac-evolution-trpc').canAny
declare const canAll: typeof import('@anievo-id/rbac-evolution-trpc').canAll
declare const createGuards: typeof import('@anievo-id/rbac-evolution-trpc').createGuards

/** zod, the parts the snippets use (tRPC accepts any `{ parse }` validator). */
declare module 'zod' {
  interface ZodType<T> {
    parse(input: unknown): T
    readonly _output: T
  }
  export const z: {
    object<S extends Record<string, ZodType<unknown>>>(shape: S): ZodType<{ [K in keyof S]: S[K]['_output'] }>
    string(): ZodType<string>
  }
}
