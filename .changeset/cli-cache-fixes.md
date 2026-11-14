---
'@anievo-id/rbac-evolution': patch
'@anievo-id/rbac-evolution-cli': minor
---

CLI and cache fixes:

- **cli**: `sync --prune` now requires `--yes` (or `--dry-run` to preview), so a typo in `--file` can't delete every
  role and permission without asking. **Scripts that run `sync --prune` need to add `--yes`.**
- **cli**: subject and team ids become numbers only when that is lossless. `9007199254740993` (beyond
  `Number.MAX_SAFE_INTEGER`) and `007` stay strings instead of silently pointing at another subject.
- **core**: `MemoryCache` keeps at most `maxEntries` entries (default 10 000) and drops the oldest write when full,
  so a long-running process checking many different users no longer grows without bound. Configure it with
  `new MemoryCache({ maxEntries })`.
