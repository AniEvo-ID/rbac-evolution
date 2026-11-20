# @anievo-id/rbac-evolution-trpc

## 1.8.0

### Patch Changes

- @anievo-id/rbac-evolution@1.8.0

## 1.7.0

### Patch Changes

- @anievo-id/rbac-evolution@1.7.0

## 1.6.0

### Patch Changes

- @anievo-id/rbac-evolution@1.6.0

## 1.5.0

### Minor Changes

- 3a7c33d: New package: `@anievo-id/rbac-evolution-trpc`, the tRPC (v11) integration. `t.procedure.use(requirePermission('posts.edit'))`, `requireRole()`, `requireRoleOrPermission()`, `canAny()` and `canAll()` take the same arguments as the other integrations (pipe lists, `{ any }` / `{ all }`, `{ guard }`, `exposeRequirements`), and after them `ctx.rbac` is a non-null `SubjectRbac`. `createRbacContext()` builds `ctx.rbac` in `createContext`; `createGuards<AppRbac>()` (or `createGuards<AppRbac, 'api'>()` with names per guard) checks names at compile time, and its `resolve` option reads the subject from the call instead. Denials throw a `TRPCError` `UNAUTHORIZED` / `FORBIDDEN`; `rbacErrorFormatter` gives clients the usual `{ error, reason, message, required? }` body as `error.data.rbac`.

### Patch Changes

- Updated dependencies [72e73a6]
  - @anievo-id/rbac-evolution@1.5.0
