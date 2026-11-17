---
'@anievo-id/rbac-evolution-react-router': minor
---

New package `@anievo-id/rbac-evolution-react-router` for React Router 7 and 8 (framework mode) and Remix 2. `createRbacServer({ rbac, getSubject })` returns `getRbac(args)`, `getSnapshot(args)` (for `<RbacProvider>` of the React package) and the `requirePermission`, `requireRole`, `requireRoleOrPermission`, `canAny` and `canAll` guards for loaders and actions. A guard resolves to the subject, or throws a standard `Response`: a 401 or 403 with the same JSON body as the other integrations (the route's `ErrorBoundary` gets it as a route error response), or a redirect with `unauthenticatedRedirect` / `forbiddenRedirect`. It has no runtime import of React Router. Typed names, teams and guards work as in the other integrations.
