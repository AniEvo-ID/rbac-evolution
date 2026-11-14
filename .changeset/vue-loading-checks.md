---
'@anievo-id/rbac-evolution-vue': patch
---

While `loading`, every check returns `false`, `cannot()` included (it returned `true`), and a snapshot passed together with `loading: true` grants nothing until `setSnapshot()` is called. Same behaviour as the React package since 0.6.2.
