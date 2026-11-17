// Koa recipe: the app's own auth middleware and route handlers. Koa itself is a stand-in in modules.d.ts.
declare const rbac: Rbac
declare const yourAuthMiddleware: import('koa').Middleware
declare const updateArticle: import('koa').Middleware
declare const getStats: import('koa').Middleware
