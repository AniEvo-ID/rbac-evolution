// Next.js guide: the helpers of `lib/rbac.ts` ("Setup"), for the snippets that use them without the import.
type NextRbac = typeof import('../lib/rbac')
type NextRequest = import('next/server').NextRequest

declare const rbac: Rbac
declare const adapter: RbacAdapter
declare const getSubject: () => Promise<Subject | null>
declare const createNextRbac: typeof import('@anievo-id/rbac-evolution-next').createNextRbac
declare const createRbacMiddleware: typeof import('@anievo-id/rbac-evolution-next/middleware').createRbacMiddleware
declare const requirePermission: NextRbac['requirePermission']
declare const requireRole: NextRbac['requireRole']
declare const authorize: NextRbac['authorize']
declare const can: NextRbac['can']
declare const withRbac: NextRbac['withRbac']

/** The typed names of "Typed names". */
type AppRbac = { permissions: 'articles.view' | 'articles.edit' | 'articles.publish' | 'articles.delete' }
/** A route handler, for `withRbac(handler, ...)`. */
declare const handler: (req: Request) => Promise<Response>
/** A page's `params` (already awaited). */
declare const params: { teamId: string }
declare function readSnapshotFromSession(req: NextRequest): Promise<RbacSnapshot | null>
declare function StaffNotes(): React.JSX.Element
