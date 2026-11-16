// What the app's own auth plugin puts on the request.
import 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: number }
    apiClient?: { id: string }
  }
}
