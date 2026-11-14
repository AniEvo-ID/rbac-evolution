import { describe } from 'vitest'
import { runMongoSuite } from './shared'

const url = process.env.MONGO_URL

// Real MongoDB server, e.g. MONGO_URL=mongodb://localhost:27017/rbac
describe.skipIf(url === undefined || url === '')('mongoose (MONGO_URL)', () => {
  runMongoSuite('mongoose (MONGO_URL)', () => url ?? '')
})
