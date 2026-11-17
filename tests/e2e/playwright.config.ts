import { defineConfig, devices } from '@playwright/test'

// Ports are fixed and unusual so a dev server you already run on 3000/4000/5173 doesn't get reused by mistake.
const VUE = 'http://localhost:4100'
const NEXT = 'http://localhost:3100'
const NEST = 'http://localhost:4200'
const DOCS = 'http://localhost:4174/rbac-evolution/'

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  workers: 1, // the examples share one SQLite file each; specs change data
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['./summary-reporter.ts']],
  use: { ...devices['Desktop Chrome'], trace: 'retain-on-failure' },
  projects: [
    { name: 'vue-express', testMatch: 'vue-express.spec.ts', use: { baseURL: VUE } },
    { name: 'next-prisma', testMatch: 'next-prisma.spec.ts', use: { baseURL: NEXT } },
    { name: 'nestjs-kysely', testMatch: 'nestjs-kysely.spec.ts', use: { baseURL: NEST } },
    { name: 'docs', testMatch: 'docs.spec.ts', use: { baseURL: DOCS } },
  ],
  // Run `pnpm --filter rbac-evolution-e2e prepare:apps` first: these only start the built apps.
  webServer: [
    {
      command: 'pnpm --filter rbac-evolution-example-vue-express start',
      env: { PORT: '4100' },
      url: `${VUE}/api/users`,
      cwd: '../..',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter rbac-evolution-example-next-prisma exec next start -p 3100',
      url: `${NEXT}/login`,
      cwd: '../..',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter rbac-evolution-example-nestjs-kysely start',
      env: { PORT: '4200' },
      url: `${NEST}/api/users`,
      cwd: '../..',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter @anievo-id/rbac-evolution-docs exec vitepress preview --port 4174',
      url: DOCS,
      cwd: '../..',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
