import { buildApp } from './app.js'
import { env } from './env.js'
import { prisma } from './shared/prisma.js'

const app = buildApp()

const shutdown = async () => {
  await app.close()
  await prisma.$disconnect()
}

process.once('SIGINT', () => void shutdown())
process.once('SIGTERM', () => void shutdown())

await app.listen({
  host: env.API_HOST,
  port: env.API_PORT,
})
