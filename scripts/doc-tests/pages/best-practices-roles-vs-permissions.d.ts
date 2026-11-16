declare const rbac: Rbac
declare const adapter: RbacAdapter
declare const user: Subject
declare const article: { id: number }
declare function publish(article: { id: number }): Promise<void>
// The "same applies to every layer" tabs. Both server tabs call `requirePermission`; it is typed as the
// Express guard here (the Next.js helper takes the same arguments).
declare const app: import('express').Express
declare const handler: import('express').RequestHandler
declare const requirePermission: typeof import('@anievo-id/rbac-evolution-express').requirePermission
declare const Can: typeof import('@anievo-id/rbac-evolution-react').Can
declare function PublishButton(): React.JSX.Element
