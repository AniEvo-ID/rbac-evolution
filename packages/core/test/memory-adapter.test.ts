import { MemoryAdapter } from '../src'
import { runAdapterTests } from '../src/testing'

runAdapterTests('MemoryAdapter', () => new MemoryAdapter())
