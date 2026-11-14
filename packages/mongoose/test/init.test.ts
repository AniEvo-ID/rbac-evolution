import type { Model } from 'mongoose'
import { describe, expect, it } from 'vitest'
import { MongooseRbacAdapter } from '../src/adapter'

describe('MongooseRbacAdapter init', () => {
  it('retries index creation after a failed first attempt', async () => {
    let calls = 0
    const model = {
      init: async () => {
        calls++
        if (calls === 1) throw new Error('connection reset')
      },
    } as unknown as Model<unknown>
    const adapter = new MongooseRbacAdapter({
      Permission: model,
      Role: model,
      RoleHasPermission: model,
      ModelHasRole: model,
      ModelHasPermission: model,
    } as never)
    const init = () => (adapter as unknown as { init(): Promise<unknown> }).init()

    await expect(init()).rejects.toThrow('connection reset')
    await expect(init()).resolves.toBeDefined()
    await init() // cached after success
    expect(calls).toBe(10) // 5 models on the failed attempt, 5 on the retry, none after success
  })
})
