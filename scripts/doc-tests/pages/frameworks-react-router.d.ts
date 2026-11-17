// React Router guide: the route args, the app's session helper and data, and `Outlet`. `../rbac.server` and
// `./rbac.server` are stubs in stubs/frameworks-react-router/.
type LoaderArgs = { request: Request; params: { id?: string; teamId?: string }; context: unknown }
type ActionArgs = LoaderArgs
declare const rbac: Rbac
declare const adapter: RbacAdapter
/** "your session": the signed-in user of the request. */
declare function getUser(request: Request): Promise<{ id: string } | null>
declare function getArticle(id: string | undefined): Promise<{ id: string; title: string }>
declare const Outlet: () => null
declare const createRbacServer: typeof import('@anievo-id/rbac-evolution-react-router').createRbacServer
