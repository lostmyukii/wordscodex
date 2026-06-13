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
    await prisma.studySessionItem.deleteMany()
    await prisma.studySession.deleteMany()
    await prisma.userWordProgress.deleteMany()
    await prisma.studyPlan.deleteMany()
    await prisma.authSession.deleteMany()
    await prisma.user.deleteMany()
    const publishedAt = new Date('2026-06-12T00:00:00.000Z')
    const cet4Book = await prisma.vocabularyBook.upsert({
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
    const cet4Words = [
      {
        lemma: 'ability',
        partOfSpeech: 'n.',
        definitionZh: '能力；才能',
        definitionEn: 'the power or skill to do something',
        phoneticUk: '/əˈbɪləti/',
        phoneticUs: '/əˈbɪləti/',
        exampleSentence: 'Reading improves your ability to learn.',
        exampleTranslationZh: '阅读会提升你的学习能力。',
        exampleSource: 'seed',
        position: 1,
      },
      {
        lemma: 'absorb',
        partOfSpeech: 'v.',
        definitionZh: '吸收；理解',
        definitionEn: 'to take in or understand information',
        phoneticUk: '/əbˈzɔːb/',
        phoneticUs: '/əbˈzɔːrb/',
        exampleSentence: 'The learner can absorb new words through review.',
        exampleTranslationZh: '学习者可以通过复习吸收新单词。',
        exampleSource: 'seed',
        position: 2,
      },
      {
        lemma: 'accurate',
        partOfSpeech: 'adj.',
        definitionZh: '准确的；精确的',
        definitionEn: 'correct and without mistakes',
        phoneticUk: '/ˈækjərət/',
        phoneticUs: '/ˈækjərət/',
        exampleSentence: 'Accurate answers help the system schedule reviews.',
        exampleTranslationZh: '准确作答有助于系统安排复习。',
        exampleSource: 'seed',
        position: 3,
      },
    ]
    for (const word of cet4Words) {
      await prisma.vocabularyWord.upsert({
        where: {
          vocabularyBookId_lemma: {
            vocabularyBookId: cet4Book.id,
            lemma: word.lemma,
          },
        },
        update: word,
        create: {
          ...word,
          vocabularyBookId: cet4Book.id,
        },
      })
    }
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
