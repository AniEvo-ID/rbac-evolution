---
'@anievo-id/rbac-evolution': patch
'@anievo-id/rbac-evolution-react': minor
'@anievo-id/rbac-evolution-vue': minor
---

- React: `<RbacProvider loading>` and Vue: `createRbacPlugin({ loading: true })`. While the snapshot is still being fetched, `<Can>`, `<Cannot>`, `<HasRole>`, `v-can` and `v-role` render nothing (not even a fallback or a `not` branch), so "read-only" content no longer flashes before the real permissions arrive. Exposed as `useRbac().loading` / `rbac.loading.value`.
- Adapter test suite (`runAdapterTests`): reverse lookups (`getSubjectIdsWithRoles` / `getSubjectIdsWithPermissions`) are now checked per team.
