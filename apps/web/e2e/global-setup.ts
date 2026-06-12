import { execFileSync } from 'node:child_process'

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://wordscodex:wordscodex@localhost:5432/wordscodex'
const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379/15'

const resetScript = `
import { PrismaPg } from '@prisma/adapter-pg'
import { createClient } from 'redis'
import { PrismaClient } from './generated/prisma/client.ts'

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
})
const redis = createClient({
  url: process.env.REDIS_URL,
})

async function main() {
  try {
    await prisma.authSession.deleteMany()
    await prisma.user.deleteMany()
    await redis.connect()
    await redis.flushDb()
  } finally {
    await prisma.$disconnect()
    if (redis.isOpen) {
      await redis.quit()
    }
  }
}

void main()
`

export default function globalSetup() {
  execFileSync(
    'pnpm',
    ['--filter', '@wordscodex/api', 'exec', 'tsx', '-e', resetScript],
    {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        REDIS_URL: redisUrl,
      },
      stdio: 'inherit',
    },
  )
}
