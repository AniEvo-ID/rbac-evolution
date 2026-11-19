# @anievo-id/rbac-evolution-sveltekit

## 1.7.0

### Patch Changes

- @anievo-id/rbac-evolution@1.7.0

## 1.6.0

### Patch Changes

- @anievo-id/rbac-evolution@1.6.0

## 1.5.0

### Minor Changes

- 3a7c33d: New package: `@anievo-id/rbac-evolution-sveltekit`, the SvelteKit 2 / 3 integration (Svelte 5).
  
  - `/server`: `rbacHandle({ rbac, getSubject })`, a `handle` hook that sets `event.locals.rbac` (`RbacLocals<AppRbac>`
    types it in `App.Locals`); `requirePermission`, `requireRole`, `requireRoleOrPermission`, `canAny` and `canAll`
    for `load` functions, form actions and `+server.ts` endpoints, with the same semantics, `{ guard }` option and
    401 / 403 bodies as the other integrations, thrown as SvelteKit `error()`s (or redirects with
    `unauthenticatedRedirect` / `forbiddenRedirect` / `onUnauthenticated` / `onForbidden`); `createGuards<AppRbac>()`
    and `createGuards<AppRbac, 'api'>()` for typed names; `getSnapshot(event, { checkBefore })` for the root layout.
  - `.`: `setRbacContext(() => data.rbac, { superAdminRoles, wildcard })` and `getRbacContext()` (Svelte 5 runes),
    `<Can>` and `<HasRole>` with `children` / `fallback` snippets, honouring super-admin roles and the snapshot's
    `denied`, and `createRbacChecker()` for universal loads.

### Patch Changes

- Updated dependencies [72e73a6]
  - @anievo-id/rbac-evolution@1.5.0
