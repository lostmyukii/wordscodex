import cors from '@fastify/cors'
import Fastify from 'fastify'
import { healthRoutes } from './routes/health.js'

export function buildApp() {
  const app = Fastify({
    logger: false,
  })

  void app.register(cors, {
    origin: true,
    credentials: true,
  })
  void app.register(healthRoutes, {
    prefix: '/api/v1',
  })

  return app
}
