// SvelteKit guide: the free variables of its snippets. The app modules it imports (`$lib/server/rbac`, a route's
// `./$types`) are stubs in stubs/frameworks-sveltekit/.
declare const adapter: RbacAdapter
declare const yourAdapter: RbacAdapter
/** The app's own auth hook (Lucia, Auth.js, a session cookie, ...), which sets `event.locals.user`. */
declare const authHandle: Parameters<typeof import('@sveltejs/kit/hooks').sequence>[0]
