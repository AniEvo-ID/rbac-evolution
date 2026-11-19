---
'@anievo-id/rbac-evolution-tanstack-start': minor
---

New package `@anievo-id/rbac-evolution-tanstack-start` for TanStack Start 1.x (React and Solid). `createRbacServer({ rbac, getSubject })` returns `getRbac(request)`, `getSnapshot(request)` (for `<RbacProvider>` of the React package) and the `requirePermission`, `requireRole`, `requireRoleOrPermission`, `canAny` and `canAll` guards for server functions (`getRequest()`), middleware and server routes. A guard resolves to the subject, or throws a standard `Response`: a 401 or 403 with the same JSON body as the other integrations, or what `onUnauthenticated` / `onForbidden` return, such as TanStack Router's `redirect()`. It has no runtime import of TanStack, and the subject is resolved once per request. Typed names, teams and guards work as in the other integrations.
