import { buildApp } from './app.js'
import { env } from './env.js'

const app = buildApp({
  config: {
    webOrigin: env.WEB_ORIGIN,
    nodeEnv: env.NODE_ENV,
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    jwtAccessSecret: env.JWT_ACCESS_SECRET,
    ...(env.AUTH_DEV_CODE ? { authDevCode: env.AUTH_DEV_CODE } : {}),
  },
})

const shutdown = async () => {
  await app.close()
}

process.once('SIGINT', () => void shutdown())
process.once('SIGTERM', () => void shutdown())

await app.listen({
  host: env.API_HOST,
  port: env.API_PORT,
})
