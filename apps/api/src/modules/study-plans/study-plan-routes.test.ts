import {
  activeStudyPlanResponseSchema,
  errorResponseSchema,
  studyPlanResponseSchema,
  type StudyPlan,
  type User,
} from '@wordscodex/contracts'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../app.js'
import { AuthServiceError, type AuthService } from '../auth/auth-service.js'
import {
  ActiveStudyPlanExistsError,
  type StudyPlanRepository,
  type StudyPlanVocabularyBook,
} from './study-plan-routes.js'

const fixedNow = new Date('2026-06-13T00:00:00.000Z')
const fixedIso = fixedNow.toISOString()

const user: User = {
  id: 'user_123',
  email: null,
  displayName: '学习者',
  role: 'learner',
  accountType: 'guest',
  timezone: 'Asia/Shanghai',
  createdAt: fixedIso,
  updatedAt: fixedIso,
}

const book: StudyPlanVocabularyBook = {
  id: 'book_cet4',
  slug: 'cet4-core',
  name: '大学英语四级核心词汇',
  wordCount: 2600,
}

class MemoryStudyPlanRepository implements StudyPlanRepository {
  private activePlan: StudyPlan | null = null

  findVocabularyBook(bookId: string) {
    if (bookId === book.id || bookId === book.slug) {
      return Promise.resolve(book)
    }
    return Promise.resolve(null)
  }

  createActivePlan(input: {
    userId: string
    vocabularyBookId: string
    learningGoal: StudyPlan['learningGoal']
    dailyNewWordTarget: number
    dailyReviewLimit: number
    targetDate: Date
    reminderEnabled: boolean
    now: Date
  }) {
    if (this.activePlan) {
      throw new ActiveStudyPlanExistsError()
    }

    this.activePlan = {
      id: 'plan_123',
      userId: input.userId,
      vocabularyBookId: input.vocabularyBookId,
      learningGoal: input.learningGoal,
      dailyNewWordTarget: input.dailyNewWordTarget,
      dailyReviewLimit: input.dailyReviewLimit,
      targetDate: input.targetDate.toISOString(),
      reminderEnabled: input.reminderEnabled,
      status: 'active',
      startedAt: input.now.toISOString(),
      createdAt: input.now.toISOString(),
      updatedAt: input.now.toISOString(),
    }

    return Promise.resolve(this.activePlan)
  }

  getActivePlan(userId: string) {
    if (this.activePlan?.userId === userId)
      return Promise.resolve(this.activePlan)
    return Promise.resolve(null)
  }
}

function createAuthService(): AuthService {
  return {
    getCurrentUser(accessToken: string) {
      if (accessToken !== 'valid-token') {
        throw new AuthServiceError('UNAUTHORIZED')
      }
      return Promise.resolve(user)
    },
  } as unknown as AuthService
}

describe('study plan routes', () => {
  let app: FastifyInstance

  beforeEach(() => {
    app = buildApp({
      authService: createAuthService(),
      studyPlanRepository: new MemoryStudyPlanRepository(),
      clock: () => fixedNow,
    })
  })

  afterEach(async () => {
    await app.close()
  })

  it('creates an active study plan and estimates a target date', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/study-plans',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        vocabularyBookId: 'cet4-core',
        learningGoal: 'college',
        dailyNewWordTarget: 50,
        reminderEnabled: true,
      },
    })
    const body = studyPlanResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(201)
    expect(body.plan).toMatchObject({
      userId: 'user_123',
      vocabularyBookId: 'book_cet4',
      learningGoal: 'college',
      dailyNewWordTarget: 50,
      dailyReviewLimit: 80,
      targetDate: '2026-08-03T00:00:00.000Z',
      reminderEnabled: true,
      status: 'active',
    })
  })

  it('returns the active study plan for the current user', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/study-plans',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        vocabularyBookId: 'cet4-core',
        learningGoal: 'college',
        dailyNewWordTarget: 50,
      },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/study-plans/active',
      headers: {
        authorization: 'Bearer valid-token',
      },
    })
    const body = activeStudyPlanResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(200)
    expect(body.plan?.id).toBe('plan_123')
  })

  it('rejects unauthenticated study plan requests', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/study-plans/active',
    })
    const body = errorResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('rejects a second active study plan for the same user', async () => {
    const payload = {
      vocabularyBookId: 'cet4-core',
      learningGoal: 'college',
      dailyNewWordTarget: 50,
    }

    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/study-plans',
          headers: {
            authorization: 'Bearer valid-token',
          },
          payload,
        })
      ).statusCode,
    ).toBe(201)

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/study-plans',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload,
    })
    const body = errorResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(409)
    expect(body.error.code).toBe('ACTIVE_STUDY_PLAN_EXISTS')
  })

  it('returns not found when the selected vocabulary book does not exist', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/study-plans',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        vocabularyBookId: 'missing-book',
        learningGoal: 'college',
        dailyNewWordTarget: 50,
      },
    })
    const body = errorResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(404)
    expect(body.error).toMatchObject({
      code: 'NOT_FOUND',
      message: '词库不存在。',
    })
  })
})
