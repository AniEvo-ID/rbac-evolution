/**
 * @anievo-id/rbac-evolution-cli
 *
 * Command-line tool for rbac-evolution (like `php artisan permission:*`).
 * The package also exports `defineConfig` for `rbac.config.ts` and `run()` for programmatic use.
 */

export { CONFIG_FILES, defineConfig, findConfigFile, loadConfig } from './config'
export type { RbacCliConfig } from './config'
export { CliError, UsageError } from './errors'
export { run, VERSION } from './run'
export type { Io, RunOptions } from './run'
