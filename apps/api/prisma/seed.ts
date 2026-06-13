import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client.js'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is required')
}

const adapter = new PrismaPg({
  connectionString,
})
const prisma = new PrismaClient({ adapter })

await prisma.systemMetadata.upsert({
  where: { key: 'schema_version' },
  update: { value: 'stage-1-vocabulary' },
  create: {
    key: 'schema_version',
    value: 'stage-1-vocabulary',
  },
})

const publishedAt = new Date('2026-06-12T00:00:00.000Z')

const vocabularyBooks = [
  {
    slug: 'cet4-core',
    name: '大学英语四级核心词汇',
    category: 'college' as const,
    description: '覆盖四级高频核心词，适合大学阶段系统备考。',
    wordCount: 2600,
    version: 1,
    publishedAt,
  },
  {
    slug: 'postgraduate-core',
    name: '考研英语核心词汇',
    category: 'postgraduate' as const,
    description: '围绕考研高频词、熟词僻义和真题语境组织。',
    wordCount: 3200,
    version: 1,
    publishedAt,
  },
  {
    slug: 'workplace-business',
    name: '职场商务英语高频词',
    category: 'workplace' as const,
    description: '围绕会议、邮件和沟通场景组织的职场词库。',
    wordCount: 1800,
    version: 1,
    publishedAt,
  },
]

for (const book of vocabularyBooks) {
  await prisma.vocabularyBook.upsert({
    where: { slug: book.slug },
    update: book,
    create: book,
  })
}

await prisma.$disconnect()
