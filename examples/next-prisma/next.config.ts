import { resolve } from 'node:path'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The monorepo root (where pnpm-lock.yaml lives).
  outputFileTracingRoot: resolve(process.cwd(), '../..'),
  // `pnpm typecheck` runs `tsc` on its own, so `next build` skips it to stay fast in CI.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
}

export default nextConfig
