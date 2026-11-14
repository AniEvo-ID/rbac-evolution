import { MongoMemoryServer } from 'mongodb-memory-server'
import { describe } from 'vitest'
import { runMongoSuite } from './shared'

// In-process MongoDB (mongodb-memory-server downloads a mongod binary on first run and caches it).
describe('mongoose (mongodb-memory-server)', () => {
  let server: MongoMemoryServer | undefined
  runMongoSuite(
    'mongoose (mongodb-memory-server)',
    async () => {
      server = await MongoMemoryServer.create()
      return server.getUri()
    },
    async () => {
      await server?.stop()
    },
  )
})
