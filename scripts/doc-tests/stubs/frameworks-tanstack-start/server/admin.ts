// The guide's `src/server/admin.ts`, as `src/routes/admin.tsx` imports it.
import { createServerFn } from '@tanstack/react-start'

export const ensureAdmin = createServerFn().handler(async () => null)
