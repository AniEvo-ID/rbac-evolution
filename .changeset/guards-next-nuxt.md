---
'@anievo-id/rbac-evolution-next': patch
'@anievo-id/rbac-evolution-nuxt': patch
---

Guard fixes and spatie v8.5 `canAll()` semantics:

- **next**: `'a|b'` strings are split into "any of" (they were looked up as one name and always denied), in
  `requirePermission`, `requireRole`, `withRbac`, server actions and middleware rules, including snapshot mode.
- **next**: new `all: true` option (requirement, `requirePermission` / `requireRole` options, middleware rules)
  requires every listed permission or role, like spatie v8.5's `canAll()`; arrays still mean "any of" by default.
- **next**: middleware rules also match the percent-decoded path (`/%61dmin` is covered by `/admin`), and `RegExp`
  matchers with the `g` / `y` flag no longer flip between requests.
- **nuxt**: a page rule whose `permission`, `role` or `roleOrPermission` key is present but `undefined` now fails
  closed (401 for guests, 403 otherwise) instead of letting everyone in.
