---
'@anievo-id/rbac-evolution-solid': minor
---

New package `@anievo-id/rbac-evolution-solid` for Solid 1.8+ and 2.x: `<RbacProvider>` (every prop reactive), `<Can>`, `<Cannot>`, `<HasRole>`, `<UnlessRole>`, and `useCan()`, `useCannot()`, `useCanAny()`, `useCanAll()`, `useHasRole()`, `useHasAnyRole()`, `useHasAllRoles()` and `useRbac()`, which return accessors. Same rules as the React package (exact names, `denied`, `loading`, `wildcard`, `superAdminRoles`). It has no JSX of its own, so the same build runs with Solid's client and server builds (SolidStart, TanStack Start Solid).
