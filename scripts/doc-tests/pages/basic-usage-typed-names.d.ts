/** The union type of the first block. */
type AppRbac = {
  permissions: 'edit articles' | 'delete articles' | 'publish articles'
  roles: 'writer' | 'editor' | 'admin'
}
declare const rbac: Rbac<AppRbac>
declare const adapter: RbacAdapter
declare const user: Subject
// "In guards, middleware and the CLI": one line per framework.
declare const app: import('express').Express
declare const handler: import('express').RequestHandler
declare const createGuards: typeof import('@anievo-id/rbac-evolution-express').createGuards
declare const createRbacDecorators: typeof import('@anievo-id/rbac-evolution-nestjs').createRbacDecorators
declare const createNextRbac: typeof import('@anievo-id/rbac-evolution-next').createNextRbac
declare const getSubject: () => Promise<Subject | null>
declare const defineConfig: typeof import('@anievo-id/rbac-evolution-cli').defineConfig
