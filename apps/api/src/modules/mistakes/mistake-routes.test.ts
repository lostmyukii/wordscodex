import {
  errorResponseSchema,
  mistakeListResponseSchema,
  studySessionResponseSchema,
  type MistakeListResponse,
  type StudyPlan,
  type StudySession,
  type User,
} from '@wordscodex/contracts'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../app.js'
import { AuthServiceError, type AuthService } from '../auth/auth-service.js'
import {
  EmptyMistakeSessionError,
  NoActiveMistakePlanError,
  type MistakeRepository,
} from './mistake-routes.js'

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

const otherUser: User = {
  ...user,
  id: 'user_other',
}

const plan: StudyPlan = {
  id: 'plan_123',
  userId: user.id,
  vocabularyBookId: 'book_cet4',
  learningGoal: 'college',
  dailyNewWordTarget: 50,
  dailyReviewLimit: 80,
  targetDate: null,
  reminderEnabled: true,
  status: 'active',
  startedAt: fixedIso,
  createdAt: fixedIso,
  updatedAt: fixedIso,
}

const word = {
  id: 'word_ability',
  lemma: 'ability',
  phoneticUk: '/əˈbɪləti/',
  phoneticUs: '/əˈbɪləti/',
  audioUkUrl: null,
  audioUsUrl: null,
  imageUrl: null,
  meanings: [
    {
      partOfSpeech: 'n.',
      definitionZh: '能力；才能',
      definitionEn: 'the power or skill to do something',
    },
  ],
  examples: [
    {
      sentence: 'Reading improves your ability to learn.',
      translationZh: '阅读会提升你的学习能力。',
      source: 'seed',
    },
  ],
}

const mistakeItem: MistakeListResponse['items'][number] = {
  word,
  masteryState: 'mistake',
  repetitions: 1,
  correctCount: 0,
  incorrectCount: 1,
  lastReviewedAt: fixedIso,
  nextReviewAt: '2026-06-13T00:10:00.000Z',
  lastErrorType: 'word_to_meaning',
  updatedAt: fixedIso,
}

const mistakeSession: StudySession = {
  id: 'session_mistake',
  userId: user.id,
  mode: 'mistake_drill',
  status: 'active',
  startedAt: fixedIso,
  completedAt: null,
  items: [
    {
      id: 'item_1',
      position: 1,
      questionType: 'word_to_meaning',
      word,
    },
  ],
}

class MemoryMistakeRepository implements MistakeRepository {
  activePlan: StudyPlan | null = plan
  items: MistakeListResponse['items'] = [mistakeItem]
  createSessionCalls: Array<{
    userId: string
    limit: number
    now: Date
  }> = []

  listMistakes(userId: string) {
    if (userId !== user.id || !this.activePlan) {
      return Promise.resolve({
        plan: null,
        summary: {
          total: 0,
          dueNow: 0,
        },
        items: [],
      })
    }

    return Promise.resolve({
      plan: this.activePlan,
      summary: {
        total: this.items.length,
        dueNow: this.items.filter(
          (item) => item.nextReviewAt && item.nextReviewAt <= fixedIso,
        ).length,
      },
      items: this.items,
    })
  }

  createMistakeDrillSession(input: {
    userId: string
    limit: number
    now: Date
  }) {
    this.createSessionCalls.push(input)
    if (input.userId !== user.id || !this.activePlan) {
      throw new NoActiveMistakePlanError()
    }
    if (this.items.length === 0) {
      throw new EmptyMistakeSessionError()
    }

    return Promise.resolve(mistakeSession)
  }
}

function createAuthService(): AuthService {
  return {
    getCurrentUser(accessToken: string) {
      if (accessToken === 'valid-token') return Promise.resolve(user)
      if (accessToken === 'other-token') return Promise.resolve(otherUser)
      throw new AuthServiceError('UNAUTHORIZED')
    },
  } as unknown as AuthService
}

describe('mistake routes', () => {
  let app: FastifyInstance
  let repository: MemoryMistakeRepository

  beforeEach(() => {
    repository = new MemoryMistakeRepository()
    app = buildApp({
      authService: createAuthService(),
      mistakeRepository: repository,
      clock: () => fixedNow,
    })
  })

  afterEach(async () => {
    await app.close()
  })

  it('returns active-plan mistake words for the current user', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/mistakes',
      headers: {
        authorization: 'Bearer valid-token',
      },
    })
    const body = mistakeListResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(200)
    expect(body.summary).toEqual({
      total: 1,
      dueNow: 0,
    })
    expect(body.items[0]).toMatchObject({
      masteryState: 'mistake',
      word: {
        lemma: 'ability',
      },
    })
  })

  it('creates a mistake drill session', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/mistakes/session',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        limit: 12,
      },
    })
    const body = studySessionResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(201)
    expect(body.session.mode).toBe('mistake_drill')
    expect(repository.createSessionCalls[0]).toMatchObject({
      userId: user.id,
      limit: 12,
      now: fixedNow,
    })
  })

  it('rejects unauthenticated mistake requests', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/mistakes',
    })
    const body = errorResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns an empty state when the current user has no active plan', async () => {
    repository.activePlan = null

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/mistakes',
      headers: {
        authorization: 'Bearer valid-token',
      },
    })
    const body = mistakeListResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(200)
    expect(body.plan).toBeNull()
    expect(body.items).toEqual([])
  })

  it('rejects mistake drill creation without an active plan', async () => {
    repository.activePlan = null

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/mistakes/session',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {},
    })
    const body = errorResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(409)
    expect(body.error.code).toBe('NO_ACTIVE_STUDY_PLAN')
  })

  it('rejects mistake drill creation when there are no mistake words', async () => {
    repository.items = []

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/mistakes/session',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {},
    })
    const body = errorResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(409)
    expect(body.error.code).toBe('EMPTY_MISTAKE_SESSION')
  })
})
