// Nuxt guide: Nuxt's and Nitro's auto-imports, with the types `nuxi prepare` generates for them.
// doc-test: no-dom (the snippets' `event` is an h3 event, not the DOM's global one)
declare const rbac: Rbac
declare const adapter: RbacAdapter

// nuxt.config.ts
declare const defineNuxtConfig: typeof import('nuxt/config').defineNuxtConfig

// Server (Nitro): h3's handler and the helpers of server/utils/rbac.ts.
type H3Event = import('h3').H3Event
declare const defineEventHandler: typeof import('h3').defineEventHandler
declare const rbacServer: typeof import('../server/utils/rbac').rbacServer
declare const createRbacServer: typeof import('@anievo-id/rbac-evolution-nuxt/server').createRbacServer
/** The app's own auth (nuxt-auth-utils' `getUserSession`). */
declare function getUserSession(event: H3Event): Promise<{ user?: { id: string } }>
declare const yourAdapter: RbacAdapter
declare const getSubject: (event: H3Event) => Promise<Subject | null>
declare const event: H3Event
/** The typed names of "Typed names". */
type AppRbac = { permissions: 'articles.edit' | 'articles.publish'; roles: 'admin' | 'editor' }

// App: the module's auto-imported composable, the page macro typed by its PageMeta augmentation, and
// `$fetch` typed by Nitro from the `/api/me/permissions` route ("After login and logout").
declare function useRbac(): import('@anievo-id/rbac-evolution-nuxt').NuxtRbac
declare function definePageMeta(meta: { rbac?: import('@anievo-id/rbac-evolution-nuxt').RbacRouteRule }): void
declare function $fetch(url: '/api/me/permissions'): Promise<RbacSnapshot | null>
