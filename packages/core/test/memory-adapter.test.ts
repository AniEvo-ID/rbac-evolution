import type { RbacAdapter } from '../src'
import { MemoryAdapter } from '../src'
import { runAdapterTests } from '../src/testing'

runAdapterTests('MemoryAdapter', () => new MemoryAdapter())

runAdapterTests('MemoryAdapter (teams: false)', () => new MemoryAdapter(), { teams: false })

// A 1.0 custom adapter has none of the optional methods: the suite must still pass, skipping their tests.
const OPTIONAL = new Set<PropertyKey>(['getSubjectLinks', 'getTeamLinks', 'detachTeamLinks'])
runAdapterTests('MemoryAdapter without the optional methods', () => {
  const inner = new MemoryAdapter()
  return new Proxy(inner, {
    get(target, key, receiver) {
      if (OPTIONAL.has(key)) return undefined
      const value: unknown = Reflect.get(target, key, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  }) as RbacAdapter
})
