// What the panel's SSO plugin puts on the request.
import 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    staff?: { id: number }
  }
}
