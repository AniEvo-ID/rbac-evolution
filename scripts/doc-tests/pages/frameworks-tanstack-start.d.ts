// TanStack Start guide: the app's session helper and `Outlet`. The app modules (`../rbac`, `./rbac`, `../middleware`,
// `../server/admin`) are stubs in stubs/frameworks-tanstack-start/; the TanStack modules are in modules.d.ts.
declare const rbac: Rbac
declare const adapter: RbacAdapter
/** "your session": the signed-in user of the request. */
declare function getUser(request: Request): Promise<{ id: string } | null>
declare const Outlet: () => null
declare const createRbacServer: typeof import('@anievo-id/rbac-evolution-tanstack-start').createRbacServer
