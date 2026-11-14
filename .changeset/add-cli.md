---
"@anievo-id/rbac-evolution-cli": minor
---

New package `@anievo-id/rbac-evolution-cli` — the equivalent of spatie's `php artisan permission:*` commands: `create-permission`, `create-role` (with `"a|b"` permissions), `assign-role`, `give-permission`, `show` (role × permission matrix, `--json`), `cache-reset` and `init`. Reads `rbac.config.ts` (TypeScript supported), supports `--guard`, `--team` and `--type`, and spatie-style names like `permission:create-role`.
