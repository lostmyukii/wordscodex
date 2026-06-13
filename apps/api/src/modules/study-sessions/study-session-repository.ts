import type {
  QuestionType,
  StudySession,
  StudySessionMode,
  Word,
} from '@wordscodex/contracts'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import {
  EmptyStudySessionError,
  NoActiveStudyPlanError,
  type TodayOverview,
} from './study-session-routes.js'
import type { StudyPlan } from '@wordscodex/contracts'

type WordRecord = {
  id: string
  lemma: string
  partOfSpeech: string
  definitionZh: string
  definitionEn: string | null
  phoneticUk: string | null
  phoneticUs: string | null
  audioUkUrl: string | null
  audioUsUrl: string | null
  imageUrl: string | null
  exampleSentence: string | null
  exampleTranslationZh: string | null
  exampleSource: string | null
}

type SessionRecord = {
  id: string
  userId: string
  mode: StudySessionMode
  status: 'active' | 'completed' | 'abandoned'
  startedAt: Date
  completedAt: Date | null
  items: Array<{
    id: string
    position: number
    questionType: QuestionType
    word: WordRecord
  }>
}

type StudyPlanRecord = {
  id: string
  userId: string
  vocabularyBookId: string
  learningGoal: 'k12' | 'college' | 'postgraduate' | 'overseas' | 'workplace'
  dailyNewWordTarget: number
  dailyReviewLimit: number
  targetDate: Date | null
  reminderEnabled: boolean
  status: 'active' | 'paused' | 'completed'
  startedAt: Date
  createdAt: Date
  updatedAt: Date
}

export class PrismaStudySessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getTodayOverview(
    userId: string,
    now: Date,
  ): Promise<TodayOverview | null> {
    const plan = await this.findActivePlan(userId)
    if (!plan) return null

    const dayStart = startOfUtcDay(now)
    const dayEnd = new Date(dayStart)
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1)

    const [dueReviewCount, newWordsAvailable, completedSessions] =
      await this.prisma.$transaction([
        this.prisma.userWordProgress.count({
          where: {
            userId,
            nextReviewAt: {
              lte: now,
            },
          },
        }),
        this.prisma.vocabularyWord.count({
          where: {
            vocabularyBookId: plan.vocabularyBookId,
            progress: {
              none: {
                userId,
              },
            },
          },
        }),
        this.prisma.studySession.count({
          where: {
            userId,
            status: 'completed',
            completedAt: {
              gte: dayStart,
              lt: dayEnd,
            },
          },
        }),
      ])

    return {
      plan: toStudyPlan(plan),
      dueReviewCount,
      newWordsAvailable,
      completedSessions,
    }
  }

  async createSession(input: {
    userId: string
    mode: StudySessionMode
    newWordLimit: number
    reviewLimit: number
    now: Date
  }): Promise<StudySession> {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.studyPlan.findFirst({
        where: {
          userId: input.userId,
          status: 'active',
        },
        orderBy: {
          startedAt: 'desc',
        },
      })

      if (!plan) throw new NoActiveStudyPlanError()

      const words: WordRecord[] = []

      if (input.mode === 'review' || input.mode === 'mixed') {
        const dueProgress = await tx.userWordProgress.findMany({
          where: {
            userId: input.userId,
            nextReviewAt: {
              lte: input.now,
            },
          },
          orderBy: [
            {
              nextReviewAt: 'asc',
            },
            {
              updatedAt: 'asc',
            },
          ],
          take: normalizeTake(input.reviewLimit),
          include: {
            word: true,
          },
        })
        words.push(...dueProgress.map((progress) => progress.word))
      }

      if (input.mode === 'new_words' || input.mode === 'mixed') {
        const newWords = await tx.vocabularyWord.findMany({
          where: {
            vocabularyBookId: plan.vocabularyBookId,
            progress: {
              none: {
                userId: input.userId,
              },
            },
          },
          orderBy: {
            position: 'asc',
          },
          take: normalizeTake(input.newWordLimit),
        })
        words.push(...newWords)
      }

      if (words.length === 0) throw new EmptyStudySessionError()

      const session = await tx.studySession.create({
        data: {
          userId: input.userId,
          mode: input.mode,
          status: 'active',
          startedAt: input.now,
          items: {
            create: words.map((word, index) => ({
              wordId: word.id,
              position: index + 1,
              questionType: 'word_to_meaning',
            })),
          },
        },
        include: sessionInclude,
      })

      return toStudySession(session)
    })
  }

  async getSession(sessionId: string, userId: string) {
    const session = await this.prisma.studySession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
      include: sessionInclude,
    })

    return session ? toStudySession(session) : null
  }

  private findActivePlan(userId: string) {
    return this.prisma.studyPlan.findFirst({
      where: {
        userId,
        status: 'active',
      },
      orderBy: {
        startedAt: 'desc',
      },
    })
  }
}

const sessionInclude = {
  items: {
    orderBy: {
      position: 'asc' as const,
    },
    include: {
      word: true,
    },
  },
}

function toStudyPlan(record: StudyPlanRecord): StudyPlan {
  return {
    ...record,
    targetDate: record.targetDate?.toISOString() ?? null,
    startedAt: record.startedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

function toStudySession(record: SessionRecord): StudySession {
  return {
    id: record.id,
    userId: record.userId,
    mode: record.mode,
    status: record.status,
    startedAt: record.startedAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    items: record.items.map((item) => ({
      id: item.id,
      position: item.position,
      questionType: item.questionType,
      word: toWord(item.word),
    })),
  }
}

function toWord(record: WordRecord): Word {
  return {
    id: record.id,
    lemma: record.lemma,
    phoneticUk: record.phoneticUk,
    phoneticUs: record.phoneticUs,
    audioUkUrl: record.audioUkUrl,
    audioUsUrl: record.audioUsUrl,
    imageUrl: record.imageUrl,
    meanings: [
      {
        partOfSpeech: record.partOfSpeech,
        definitionZh: record.definitionZh,
        definitionEn: record.definitionEn,
      },
    ],
    examples:
      record.exampleSentence && record.exampleTranslationZh
        ? [
            {
              sentence: record.exampleSentence,
              translationZh: record.exampleTranslationZh,
              source: record.exampleSource,
            },
          ]
        : [],
  }
}

function normalizeTake(value: number) {
  return Math.max(0, Math.floor(value))
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
}
