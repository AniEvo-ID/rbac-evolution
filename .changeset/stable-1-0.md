---
'@anievo-id/rbac-evolution': major
---

**1.0: the stable API.** There are no breaking changes from 0.9: code that runs on 0.9 runs on 1.0. What changes is the promise. From 1.0 on, the public API of every package changes in a breaking way only in a new major version, every supported runtime, database and framework version is tested in CI, and security fixes have a supported version range.

- What a patch, minor or major release may change, the support table and the deprecation policy: https://creation.anievo.id/rbac-evolution/guide/versioning
- Coming from an older 0.x release: https://creation.anievo.id/rbac-evolution/guide/upgrading
- Coming from spatie/laravel-permission: https://creation.anievo.id/rbac-evolution/guide/coming-from-laravel
