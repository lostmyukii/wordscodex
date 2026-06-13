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
    await prisma.studyPlan.deleteMany()
    await prisma.authSession.deleteMany()
    await prisma.user.deleteMany()
    const publishedAt = new Date('2026-06-12T00:00:00.000Z')
    await prisma.vocabularyBook.upsert({
      where: { slug: 'cet4-core' },
      update: {
        name: '大学英语四级核心词汇',
        category: 'college',
        description: '覆盖四级高频核心词，适合大学阶段系统备考。',
        wordCount: 2600,
        version: 1,
        publishedAt,
      },
      create: {
        slug: 'cet4-core',
        name: '大学英语四级核心词汇',
        category: 'college',
        description: '覆盖四级高频核心词，适合大学阶段系统备考。',
        wordCount: 2600,
        version: 1,
        publishedAt,
      },
    })
    await prisma.vocabularyBook.upsert({
      where: { slug: 'workplace-business' },
      update: {
        name: '职场商务英语高频词',
        category: 'workplace',
        description: '围绕会议、邮件和沟通场景组织的职场词库。',
        wordCount: 1800,
        version: 1,
        publishedAt,
      },
      create: {
        slug: 'workplace-business',
        name: '职场商务英语高频词',
        category: 'workplace',
        description: '围绕会议、邮件和沟通场景组织的职场词库。',
        wordCount: 1800,
        version: 1,
        publishedAt,
      },
    })
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
