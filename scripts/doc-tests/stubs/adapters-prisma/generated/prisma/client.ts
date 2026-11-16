// `generated/prisma/client`: what `prisma generate` writes with Prisma 7's `prisma-client` generator
// (`output = "../generated/prisma"`). The same delegates as the `@prisma/client` stand-in in modules.d.ts, but
// the constructor needs a driver adapter, as on Prisma 7.
import { PrismaClient as Client } from '@prisma/client'

export class PrismaClient extends Client {
  constructor(options: { adapter: { readonly provider: string; readonly adapterName: string } }) {
    super(options)
  }
}
