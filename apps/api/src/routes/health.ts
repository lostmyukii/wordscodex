import type { HealthResponse } from '@wordscodex/contracts'
import type { FastifyPluginCallback } from 'fastify'

export const healthRoutes: FastifyPluginCallback = (app, _options, done) => {
  app.get<{ Reply: HealthResponse }>('/health', () => ({
    status: 'ok',
    service: 'wordscodex-api',
  }))
  done()
}
