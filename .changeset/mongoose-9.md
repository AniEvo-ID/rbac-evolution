---
'@anievo-id/rbac-evolution-mongoose': minor
---

Support Mongoose 9. The `mongoose` peer range is now `^8.0.0 || ^9.0.0`; Mongoose 8 keeps working as before. The adapter, schemas and data don't change, so there is nothing to migrate. Mongoose 9 needs Node.js 20.19 or later (MongoDB driver 7). MongoDB 6 or later, as before. If you add `pre` hooks to the schemas of `rbacSchemas()`, write them as `async` functions: Mongoose 9 no longer passes `next()`.

`rbacSchemas()` now declares its return type (`Schema<PermissionDoc>`, `Schema<RoleDoc>`, ...) instead of an inferred one that spelled out internal Mongoose types. Those differ between Mongoose 8 and 9, so the published types work with both.
