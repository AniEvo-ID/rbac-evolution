---
'@anievo-id/rbac-evolution-nuxt': patch
'@anievo-id/rbac-evolution-vue': patch
'@anievo-id/rbac-evolution-prisma': patch
---

Fixes:

- Nuxt: each `createRbacServer()` caches its own subject per request, so a second helper (e.g. guard `api`) no longer reuses another guard's subject. The first helper to resolve still fills `event.context.rbac` for the client plugin.
- Vue: `v-can` / `v-role` (and the state checks) treat an `undefined` or `null` value as an empty list and hide the element, instead of throwing and leaving it visible.
- Prisma: the adapter works with an interactive-transaction client (`prisma.$transaction(async (tx) => …)`); deleting a role or permission no longer fails there.
