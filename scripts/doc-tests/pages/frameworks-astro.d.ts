// Astro guide: `App.Locals` (the guide's `src/env.d.ts`), Astro's context type, the app's auth middleware.
// `./rbac` is a stub in stubs/frameworks-astro/src/; `astro:middleware` is in modules.d.ts.
declare namespace App {
  interface Locals {
    user?: { id: string }
  }
}
type APIContext = import('astro').APIContext
declare const rbac: Rbac
declare const adapter: RbacAdapter
/** The app's auth middleware: it sets `locals.user`. */
declare const auth: import('astro').MiddlewareHandler
declare const createRbacServer: typeof import('@anievo-id/rbac-evolution-astro').createRbacServer
