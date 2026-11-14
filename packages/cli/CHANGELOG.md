# @anievo-id/rbac-evolution-cli

## 0.6.2

### Patch Changes

- Updated dependencies [70a7cf2]
  - @anievo-id/rbac-evolution@0.6.2

## 0.6.1

### Patch Changes

- @anievo-id/rbac-evolution@0.6.1

## 0.6.0

### Patch Changes

- Updated dependencies [7cef7cb]
  - @anievo-id/rbac-evolution@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [e9f2c48]
  - @anievo-id/rbac-evolution@0.5.0

## 0.4.1

### Patch Changes

- @anievo-id/rbac-evolution@0.4.1

## 0.4.0

### Minor Changes

- ed88963: CLI and cache fixes:

  - **cli**: `sync --prune` now requires `--yes` (or `--dry-run` to preview), so a typo in `--file` can't delete every
    role and permission without asking. **Scripts that run `sync --prune` need to add `--yes`.**
  - **cli**: subject and team ids become numbers only when that is lossless. `9007199254740993` (beyond
    `Number.MAX_SAFE_INTEGER`) and `007` stay strings instead of silently pointing at another subject.
  - **core**: `MemoryCache` keeps at most `maxEntries` entries (default 10 000) and drops the oldest write when full,
    so a long-running process checking many different users no longer grows without bound. Configure it with
    `new MemoryCache({ maxEntries })`.

### Patch Changes

- Updated dependencies [9f8a114]
- Updated dependencies [5812866]
- Updated dependencies [ed88963]
  - @anievo-id/rbac-evolution@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [a890bc2]
  - @anievo-id/rbac-evolution@0.3.1

## 0.3.0

### Minor Changes

- b20a7cf: Add declarative seeding. Core: `rbac.sync(definition, { guard, team, prune, dryRun })` creates missing permissions and roles, syncs each role's permissions (`'*'` = every permission of the guard), optionally prunes what isn't declared, and returns a `{ created, updated, deleted }` summary (or the plan with `dryRun`). Supports multiple guards/teams via an array of definitions, typed names and the regular events; adds the `INVALID_SYNC_DEFINITION` error code. CLI: new `rbac-evolution sync [--prune] [--dry-run] [--file roles.json|.ts] [--json]` command reading `seed` from `rbac.config` (new `defineConfig` field) or a seed file.

### Patch Changes

- Updated dependencies [b20a7cf]
  - @anievo-id/rbac-evolution@0.3.0

## 0.2.1

### Patch Changes

- Updated dependencies [f6c6b9b]
  - @anievo-id/rbac-evolution@0.2.1

## 0.2.0

### Minor Changes

- c7161a3: New package `@anievo-id/rbac-evolution-cli` — the equivalent of spatie's `php artisan permission:*` commands: `create-permission`, `create-role` (with `"a|b"` permissions), `assign-role`, `give-permission`, `show` (role × permission matrix, `--json`), `cache-reset` and `init`. Reads `rbac.config.ts` (TypeScript supported), supports `--guard`, `--team` and `--type`, and spatie-style names like `permission:create-role`.

### Patch Changes

- @anievo-id/rbac-evolution@0.2.0
