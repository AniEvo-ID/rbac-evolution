---
'@anievo-id/rbac-evolution': minor
'@anievo-id/rbac-evolution-express': minor
'@anievo-id/rbac-evolution-fastify': minor
'@anievo-id/rbac-evolution-hono': minor
'@anievo-id/rbac-evolution-nestjs': minor
---

Typed names reach the request's subject, and user input can be checked against them.

- **Request helpers keep typed names.** The options of every integration are generic over the engine (`RbacMiddlewareOptions<T>`, `RbacPluginOptions<T>`, `RbacModuleOptions<T>`, ...) and infer `T` from `rbac`. Hono: `RbacVariables<T>` / `RbacEnv<T>` take the names type or `typeof rbac`, `rbacMiddleware({ rbac })` adds a typed `c.var.rbac`, and the guards of `createGuards<T>()` keep it typed after them. Express and Fastify type the request globally, so register the engine once (`declare module '@anievo-id/rbac-evolution-express' { interface RbacRegister { rbac: typeof rbac } }`, same for Fastify) or type a handler's request as `RbacRequest<typeof rbac>`. NestJS: `getRbac<T>(context)`, and `createRbacDecorators<typeof rbac>()` takes the engine type like `createGuards`. The `onUnauthenticated` / `onForbidden` handlers of `createGuards<T>()` get the typed request (`GuardRequest<T>`, `GuardHandlerContext<T>` in Hono). Without a type argument or a registration, every type is the same as in 1.0.
- **`isRoleName(rbac, value)` / `isPermissionName(rbac, value)`**: type guards that check user input against the new `names` option of `createRbac()` (`names: { roles, permissions }`), and narrow it to `RoleName<T>` / `PermissionName<T>`. They check the list, not the database: exact names, no query. Without the list for that kind, they throw a `TypeError`.
