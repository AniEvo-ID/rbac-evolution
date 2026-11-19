---
'@anievo-id/rbac-evolution-astro': minor
---

New package `@anievo-id/rbac-evolution-astro` for Astro 4 to 7. `createRbacServer({ rbac, getSubject })` returns `getRbac(context)`, `getSnapshot(context)` (for a client island's `<RbacProvider>`) and the `requirePermission`, `requireRole`, `requireRoleOrPermission`, `canAny` and `canAll` guards for pages (`Astro`), endpoints and middleware. A guard resolves to `undefined` when the check passes, or to a standard `Response` to return: a 401 or 403 with the same JSON body as the other integrations, or a redirect with `unauthenticatedRedirect` / `forbiddenRedirect`. It has no runtime import of Astro, and the subject is resolved once per request. Typed names, teams and guards work as in the other integrations.
