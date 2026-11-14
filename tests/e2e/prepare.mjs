// Builds what the E2E run serves, from a clean state (run from the repo root after `pnpm build`):
// fresh SQLite databases + seed data for both examples, production builds, and the docs site.
import { execSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '../..')
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' })

rmSync(join(root, 'examples/vue-express/data'), { recursive: true, force: true })
for (const f of ['dev.db', 'dev.db-journal']) rmSync(join(root, 'examples/next-prisma/prisma', f), { force: true })

run('pnpm --filter rbac-evolution-example-vue-express db:setup')
run('pnpm --filter rbac-evolution-example-vue-express build')
run('pnpm --filter rbac-evolution-example-next-prisma db:setup')
run('pnpm --filter rbac-evolution-example-next-prisma build')
run('pnpm --filter @anievo-id/rbac-evolution-docs build')
