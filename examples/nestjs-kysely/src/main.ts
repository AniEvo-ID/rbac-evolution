import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { session } from './session'

const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn'] })
app.use(session)
app.enableShutdownHooks()

const port = Number(process.env['PORT'] ?? 4200)
await app.listen(port)
console.log(`NestJS example on http://localhost:${port}/api/users`)
