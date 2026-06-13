import type { StudyPlan } from '@wordscodex/contracts'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import type { StudyPlanVocabularyBook } from './study-plan-routes.js'

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

function toStudyPlan(record: StudyPlanRecord): StudyPlan {
  return {
    ...record,
    targetDate: record.targetDate?.toISOString() ?? null,
    startedAt: record.startedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

export class PrismaStudyPlanRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findVocabularyBook(
    bookId: string,
  ): Promise<StudyPlanVocabularyBook | null> {
    const book = await this.prisma.vocabularyBook.findFirst({
      where: {
        publishedAt: {
          not: null,
        },
        OR: [{ id: bookId }, { slug: bookId }],
      },
      select: {
        id: true,
        slug: true,
        name: true,
        wordCount: true,
      },
    })

    return book
  }

  async createActivePlan(input: {
    userId: string
    vocabularyBookId: string
    learningGoal: StudyPlan['learningGoal']
    dailyNewWordTarget: number
    dailyReviewLimit: number
    targetDate: Date
    reminderEnabled: boolean
    now: Date
  }) {
    const plan = await this.prisma.studyPlan.create({
      data: {
        userId: input.userId,
        vocabularyBookId: input.vocabularyBookId,
        learningGoal: input.learningGoal,
        dailyNewWordTarget: input.dailyNewWordTarget,
        dailyReviewLimit: input.dailyReviewLimit,
        targetDate: input.targetDate,
        reminderEnabled: input.reminderEnabled,
        status: 'active',
        startedAt: input.now,
      },
    })

    return toStudyPlan(plan)
  }

  async getActivePlan(userId: string) {
    const plan = await this.prisma.studyPlan.findFirst({
      where: {
        userId,
        status: 'active',
      },
      orderBy: {
        startedAt: 'desc',
      },
    })

    return plan ? toStudyPlan(plan) : null
  }
}
