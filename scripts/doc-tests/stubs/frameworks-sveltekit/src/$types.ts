// What SvelteKit generates as a route's `./$types` (`.svelte-kit/types/...`), with the route details left loose:
// the snippets of the SvelteKit guide come from several routes.
import type { Action, RequestHandler as KitRequestHandler, ServerLoad } from '@sveltejs/kit'

export type PageServerLoad = ServerLoad
export type LayoutServerLoad = ServerLoad
export type Actions = Record<string, Action>
export type RequestHandler = KitRequestHandler
