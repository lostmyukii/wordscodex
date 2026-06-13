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
  update: { value: 'stage-1-study-session' },
  create: {
    key: 'schema_version',
    value: 'stage-1-study-session',
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

const cet4Book = await prisma.vocabularyBook.findUniqueOrThrow({
  where: {
    slug: 'cet4-core',
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
  {
    lemma: 'achieve',
    partOfSpeech: 'v.',
    definitionZh: '实现；达到',
    definitionEn: 'to succeed in doing something',
    phoneticUk: '/əˈtʃiːv/',
    phoneticUs: '/əˈtʃiːv/',
    exampleSentence: 'Small daily sessions help you achieve your goal.',
    exampleTranslationZh: '每天的小学习会话能帮助你达成目标。',
    exampleSource: 'seed',
    position: 4,
  },
  {
    lemma: 'adapt',
    partOfSpeech: 'v.',
    definitionZh: '适应；调整',
    definitionEn: 'to change to fit a new situation',
    phoneticUk: '/əˈdæpt/',
    phoneticUs: '/əˈdæpt/',
    exampleSentence: 'A good plan adapts to your review results.',
    exampleTranslationZh: '好的计划会根据你的复习结果调整。',
    exampleSource: 'seed',
    position: 5,
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

await prisma.$disconnect()
