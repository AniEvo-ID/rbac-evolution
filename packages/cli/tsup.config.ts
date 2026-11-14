import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
const define = { __CLI_VERSION__: JSON.stringify(version) }
const external = ['@anievo-id/rbac-evolution', 'jiti']

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: false,
    treeshake: true,
    define,
    external,
  },
  {
    // the executable (`#!/usr/bin/env node` is kept from src/cli.ts)
    entry: ['src/cli.ts'],
    format: ['esm'],
    sourcemap: true,
    clean: false,
    define,
    external,
  },
])
