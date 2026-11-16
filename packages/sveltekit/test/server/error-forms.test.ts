// The guards throw SvelteKit's `error()`, whose signature changed in SvelteKit 3: `error(status, message, properties)`
// instead of `error(status, body)`. The dev dependency (and the `peers` CI job) cover one of them at a time; this file
// stands in for the other with a mocked `error()`, so both code paths are tested on every run.
import { beforeAll, describe, expect, it, vi } from 'vitest'

const kit = vi.hoisted(() => ({ form: 'kit3' as 'kit2' | 'kit3', calls: [] as unknown[][] }))

vi.mock('@sveltejs/kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sveltejs/kit')>()
  class FakeHttpError {
    constructor(
      readonly status: number,
      readonly body: Record<string, unknown>,
    ) {}
  }
  return {
    ...actual,
    isHttpError: (e: unknown) => e instanceof FakeHttpError,
    error: (...args: unknown[]): never => {
      kit.calls.push(args)
      const [status, message, properties] = args as [number, unknown, object | undefined]
      if (kit.form === 'kit2') {
        // SvelteKit 2: a string is the message, extra arguments are ignored.
        throw new FakeHttpError(status, typeof message === 'string' ? { message } : (message as Record<string, unknown>))
      }
      // SvelteKit 3: the message plus its properties; `status` is added to the body.
      const body = typeof message === 'string' ? { ...properties, message } : (message as Record<string, unknown>)
      throw new FakeHttpError(status, { ...body, status })
    },
  }
})

const { createGuards } = await import('../../src/server/index.js')
const { fakeEvent, seededRbac } = await import('./fixtures.js')
const { rbacHandle } = await import('../../src/server/index.js')

const event = fakeEvent(1)
beforeAll(async () => {
  await rbacHandle({ rbac: await seededRbac(), getSubject: () => ({ type: 'user', id: 1 }) })({ event, resolve: async () => new Response() })
})

const thrown = (promise: Promise<unknown>): Promise<unknown> => promise.then(() => undefined, (e: unknown) => e)

describe('error() across SvelteKit versions', () => {
  it('uses error(status, message, properties) on SvelteKit 3', async () => {
    kit.form = 'kit3'
    kit.calls = []
    const error = await thrown(createGuards().requireRole(event, 'admin'))
    expect(error).toMatchObject({
      status: 403,
      body: { error: 'FORBIDDEN', reason: 'role', message: 'User does not have the right roles.', status: 403 },
    })
    expect(kit.calls).toEqual([[403, 'User does not have the right roles.', { error: 'FORBIDDEN', reason: 'role' }]])
  })

  it('falls back to error(status, body) on SvelteKit 2', async () => {
    kit.form = 'kit2'
    kit.calls = []
    const error = await thrown(createGuards().requireRole(event, 'admin'))
    expect(error).toMatchObject({
      status: 403,
      body: { error: 'FORBIDDEN', reason: 'role', message: 'User does not have the right roles.' },
    })
    expect(kit.calls).toHaveLength(2)
    expect(kit.calls[1]).toEqual([403, { error: 'FORBIDDEN', reason: 'role', message: 'User does not have the right roles.' }])
  })
})
