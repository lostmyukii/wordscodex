import {
  completeStudySessionResponseSchema,
  errorResponseSchema,
  studySessionResultResponseSchema,
  submitReviewResponseSchema,
  studySessionResponseSchema,
  todayResponseSchema,
  type StudyPlan,
  type StudySessionResult,
  type StudySessionResponse,
  type SubmitReviewRequest,
  type SubmitReviewResult,
  type StudySession,
  type User,
} from '@wordscodex/contracts'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../app.js'
import { AuthServiceError, type AuthService } from '../auth/auth-service.js'
import { IncompleteStudySessionError } from './study-session-routes.js'

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

const session: StudySession = {
  id: 'session_123',
  userId: user.id,
  mode: 'new_words',
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

class MemoryStudySessionRepository {
  activePlan: StudyPlan | null = plan
  sessions = new Map<string, StudySession>([[session.id, session]])
  completedSessions = 0
  dueReviewCount = 0
  newWordsAvailable = 3
  createSessionCalls: Array<{
    userId: string
    mode: StudySession['mode']
    newWordLimit: number
    reviewLimit: number
    now: Date
  }> = []
  reviewCalls: Array<{
    sessionId: string
    userId: string
    idempotencyKey: string
    input: SubmitReviewRequest
    now: Date
  }> = []
  processedKeys = new Map<string, SubmitReviewResult>()

  getTodayOverview(userId: string) {
    if (userId !== user.id || !this.activePlan) {
      return Promise.resolve(null)
    }

    return Promise.resolve({
      plan: this.activePlan,
      dueReviewCount: this.dueReviewCount,
      newWordsAvailable: this.newWordsAvailable,
      completedSessions: this.completedSessions,
    })
  }

  createSession(input: {
    userId: string
    mode: StudySession['mode']
    newWordLimit: number
    reviewLimit: number
    now: Date
  }) {
    this.createSessionCalls.push(input)
    const nextSession = {
      ...session,
      mode: input.mode,
    }
    this.sessions.set(nextSession.id, nextSession)
    return Promise.resolve(nextSession)
  }

  getSession(sessionId: string, userId: string) {
    const candidate = this.sessions.get(sessionId)
    if (!candidate || candidate.userId !== userId) return Promise.resolve(null)
    return Promise.resolve({
      session: candidate,
      reviews: buildRestoredReviews(
        candidate,
        this.reviewCalls,
        this.processedKeys,
      ),
    })
  }

  submitReview(input: {
    sessionId: string
    userId: string
    idempotencyKey: string
    review: SubmitReviewRequest
    now: Date
  }) {
    const candidate = this.sessions.get(input.sessionId)
    if (!candidate || candidate.userId !== input.userId) {
      return Promise.resolve(null)
    }

    if (!candidate.items.some((item) => item.word.id === input.review.wordId)) {
      return Promise.resolve(null)
    }

    const existing = this.processedKeys.get(input.idempotencyKey)
    if (existing) {
      return Promise.resolve({
        ...existing,
        alreadyProcessed: true,
      })
    }

    this.reviewCalls.push({
      sessionId: input.sessionId,
      userId: input.userId,
      idempotencyKey: input.idempotencyKey,
      input: input.review,
      now: input.now,
    })

    const result = {
      progress: {
        masteryState: 'learning' as const,
        repetitions: 1,
        consecutiveCorrect: 1,
        correctCount: 1,
        incorrectCount: 0,
        easeFactor: 2.3,
        intervalDays: 2,
        lastReviewedAt: input.review.reviewedAt,
        nextReviewAt: '2026-06-15T00:00:00.000Z',
        averageResponseMs: input.review.responseMs,
        lastErrorType: null,
      },
      alreadyProcessed: false,
    }
    this.processedKeys.set(input.idempotencyKey, result)

    return Promise.resolve(result)
  }

  completeSession(input: { sessionId: string; userId: string; now: Date }) {
    const candidate = this.sessions.get(input.sessionId)
    if (!candidate || candidate.userId !== input.userId) {
      return Promise.resolve(null)
    }

    const reviewedWordIds = new Set(
      this.reviewCalls
        .filter((call) => call.sessionId === input.sessionId)
        .map((call) => call.input.wordId),
    )

    if (!candidate.items.every((item) => reviewedWordIds.has(item.word.id))) {
      throw new IncompleteStudySessionError()
    }

    const completedSession = {
      ...candidate,
      status: 'completed' as const,
      completedAt: input.now.toISOString(),
    }
    this.sessions.set(input.sessionId, completedSession)
    this.completedSessions = 1

    return Promise.resolve({
      session: completedSession,
      result: buildResult(completedSession, this.reviewCalls),
    })
  }

  getSessionResult(sessionId: string, userId: string) {
    const candidate = this.sessions.get(sessionId)
    if (
      !candidate ||
      candidate.userId !== userId ||
      candidate.status !== 'completed'
    ) {
      return Promise.resolve(null)
    }

    return Promise.resolve(buildResult(candidate, this.reviewCalls))
  }
}

function buildResult(
  candidate: StudySession,
  reviewCalls: MemoryStudySessionRepository['reviewCalls'],
): StudySessionResult {
  const reviewsByWordId = new Map(
    reviewCalls
      .filter((call) => call.sessionId === candidate.id)
      .map((call) => [call.input.wordId, call]),
  )
  const items = candidate.items.flatMap((item) => {
    const review = reviewsByWordId.get(item.word.id)
    if (!review) return []

    return [
      {
        word: item.word,
        questionType: item.questionType,
        rating: review.input.rating,
        isCorrect: review.input.isCorrect,
        responseMs: review.input.responseMs,
        answer: review.input.answer,
        reviewedAt: review.input.reviewedAt,
        masteryState: 'learning' as const,
        nextReviewAt: '2026-06-15T00:00:00.000Z',
      },
    ]
  })
  const correctCount = items.filter((item) => item.isCorrect).length

  return {
    session: candidate,
    summary: {
      totalItems: candidate.items.length,
      answeredItems: items.length,
      correctCount,
      incorrectCount: items.length - correctCount,
      accuracyRate: items.length === 0 ? 0 : correctCount / items.length,
      totalResponseMs: items.reduce((sum, item) => sum + item.responseMs, 0),
      completedAt: candidate.completedAt,
      canCheckIn: candidate.status === 'completed',
    },
    items,
  }
}

function buildRestoredReviews(
  candidate: StudySession,
  reviewCalls: MemoryStudySessionRepository['reviewCalls'],
  processedKeys: MemoryStudySessionRepository['processedKeys'],
): StudySessionResponse['reviews'] {
  const reviewsByWordId = new Map(
    reviewCalls
      .filter((call) => call.sessionId === candidate.id)
      .map((call) => [call.input.wordId, call]),
  )

  return candidate.items.flatMap((item) => {
    const review = reviewsByWordId.get(item.word.id)
    if (!review) return []
    const result = processedKeys.get(review.idempotencyKey)
    if (!result) return []

    return [
      {
        wordId: review.input.wordId,
        questionType: review.input.questionType,
        rating: review.input.rating,
        isCorrect: review.input.isCorrect,
        responseMs: review.input.responseMs,
        answer: review.input.answer,
        reviewedAt: review.input.reviewedAt,
        progress: result.progress,
      },
    ]
  })
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

describe('study session routes', () => {
  let app: FastifyInstance
  let repository: MemoryStudySessionRepository

  beforeEach(() => {
    repository = new MemoryStudySessionRepository()
    app = buildApp({
      authService: createAuthService(),
      studySessionRepository: repository,
      clock: () => fixedNow,
    })
  })

  afterEach(async () => {
    await app.close()
  })

  it('returns today tasks for the active plan', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/today',
      headers: {
        authorization: 'Bearer valid-token',
      },
    })
    const body = todayResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(200)
    expect(body).toMatchObject({
      summary: {
        date: '2026-06-13',
        newWordsDue: 3,
        reviewsDue: 0,
        completedSessions: 0,
        canCheckIn: false,
      },
      tasks: [
        {
          type: 'new_words',
          count: 3,
        },
      ],
      nextSessionRecommendation: {
        mode: 'new_words',
        newWordLimit: 3,
        reviewLimit: 0,
      },
    })
  })

  it('recommends a mixed session when reviews and new words are both due', async () => {
    repository.dueReviewCount = 4
    repository.newWordsAvailable = 2

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/today',
      headers: {
        authorization: 'Bearer valid-token',
      },
    })
    const body = todayResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(200)
    expect(body).toMatchObject({
      summary: {
        newWordsDue: 2,
        reviewsDue: 4,
      },
      tasks: [
        {
          type: 'review',
          count: 4,
        },
        {
          type: 'new_words',
          count: 2,
        },
      ],
      nextSessionRecommendation: {
        mode: 'mixed',
        newWordLimit: 2,
        reviewLimit: 4,
      },
    })
  })

  it('creates a new words study session from the recommendation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/study-sessions',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        mode: 'new_words',
        newWordLimit: 3,
        reviewLimit: 0,
      },
    })
    const body = studySessionResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(201)
    expect(body.session.items).toHaveLength(1)
    expect(body.session.items[0]?.word.lemma).toBe('ability')
    expect(repository.createSessionCalls[0]).toMatchObject({
      userId: user.id,
      mode: 'new_words',
      newWordLimit: 3,
      reviewLimit: 0,
    })
  })

  it('creates a review study session from the recommendation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/study-sessions',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        mode: 'review',
        newWordLimit: 0,
        reviewLimit: 4,
      },
    })
    const body = studySessionResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(201)
    expect(body.session.mode).toBe('review')
    expect(repository.createSessionCalls[0]).toMatchObject({
      userId: user.id,
      mode: 'review',
      newWordLimit: 0,
      reviewLimit: 4,
    })
  })

  it('returns a session that belongs to the current user', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/study-sessions/session_123',
      headers: {
        authorization: 'Bearer valid-token',
      },
    })
    const body = studySessionResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(200)
    expect(body.session.id).toBe('session_123')
  })

  it('rejects unauthenticated today requests', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/today',
    })
    const body = errorResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('does not expose another user session', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/study-sessions/session_123',
      headers: {
        authorization: 'Bearer other-token',
      },
    })
    const body = errorResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('submits an active recall review with an idempotency key', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/study-sessions/session_123/reviews',
      headers: {
        authorization: 'Bearer valid-token',
        'idempotency-key': 'idem_123',
      },
      payload: {
        wordId: 'word_ability',
        questionType: 'word_to_meaning',
        rating: 'good',
        isCorrect: true,
        responseMs: 4200,
        answer: '能力；才能',
        reviewedAt: fixedIso,
      },
    })
    const body = submitReviewResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(201)
    expect(repository.reviewCalls).toHaveLength(1)
    expect(repository.reviewCalls[0]).toMatchObject({
      sessionId: 'session_123',
      userId: user.id,
      idempotencyKey: 'idem_123',
    })
    expect(body.progress).toMatchObject({
      masteryState: 'learning',
      repetitions: 1,
      nextReviewAt: '2026-06-15T00:00:00.000Z',
    })
  })

  it('returns restored review state when loading an in-progress session', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/study-sessions/session_123/reviews',
      headers: {
        authorization: 'Bearer valid-token',
        'idempotency-key': 'idem_restore_session',
      },
      payload: {
        wordId: 'word_ability',
        questionType: 'word_to_meaning',
        rating: 'good',
        isCorrect: true,
        responseMs: 4200,
        answer: '认识',
        reviewedAt: fixedIso,
      },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/study-sessions/session_123',
      headers: {
        authorization: 'Bearer valid-token',
      },
    })
    const body = studySessionResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(200)
    expect(body.reviews[0]).toMatchObject({
      wordId: 'word_ability',
      questionType: 'word_to_meaning',
      rating: 'good',
      isCorrect: true,
      responseMs: 4200,
      answer: '认识',
      reviewedAt: fixedIso,
      progress: {
        masteryState: 'learning',
        nextReviewAt: '2026-06-15T00:00:00.000Z',
      },
    })
  })

  it('does not process a duplicate idempotency key twice', async () => {
    const request = {
      method: 'POST',
      url: '/api/v1/study-sessions/session_123/reviews',
      headers: {
        authorization: 'Bearer valid-token',
        'idempotency-key': 'idem_repeat',
      },
      payload: {
        wordId: 'word_ability',
        questionType: 'word_to_meaning',
        rating: 'good',
        isCorrect: true,
        responseMs: 4200,
        answer: '能力；才能',
        reviewedAt: fixedIso,
      },
    } as const

    const first = await app.inject(request)
    const second = await app.inject(request)
    const secondBody = submitReviewResponseSchema.parse(second.json())

    expect(first.statusCode).toBe(201)
    expect(second.statusCode).toBe(200)
    expect(repository.reviewCalls).toHaveLength(1)
    expect(secondBody.alreadyProcessed).toBe(true)
  })

  it('rejects a review without idempotency key', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/study-sessions/session_123/reviews',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        wordId: 'word_ability',
        questionType: 'word_to_meaning',
        rating: 'good',
        isCorrect: true,
        responseMs: 4200,
        answer: '能力；才能',
        reviewedAt: fixedIso,
      },
    })
    const body = errorResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(400)
    expect(body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED')
  })

  it('does not allow submitting another user session review', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/study-sessions/session_123/reviews',
      headers: {
        authorization: 'Bearer other-token',
        'idempotency-key': 'idem_other',
      },
      payload: {
        wordId: 'word_ability',
        questionType: 'word_to_meaning',
        rating: 'good',
        isCorrect: true,
        responseMs: 4200,
        answer: '能力；才能',
        reviewedAt: fixedIso,
      },
    })
    const body = errorResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('rejects completing a session before all items are answered', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/study-sessions/session_123/complete',
      headers: {
        authorization: 'Bearer valid-token',
      },
    })
    const body = errorResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(409)
    expect(body.error.code).toBe('STUDY_SESSION_INCOMPLETE')
  })

  it('completes an answered session and returns the study result', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/study-sessions/session_123/reviews',
      headers: {
        authorization: 'Bearer valid-token',
        'idempotency-key': 'idem_before_complete',
      },
      payload: {
        wordId: 'word_ability',
        questionType: 'word_to_meaning',
        rating: 'good',
        isCorrect: true,
        responseMs: 4200,
        answer: '认识',
        reviewedAt: fixedIso,
      },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/study-sessions/session_123/complete',
      headers: {
        authorization: 'Bearer valid-token',
      },
    })
    const body = completeStudySessionResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(200)
    expect(body.session.status).toBe('completed')
    expect(body.result.summary).toMatchObject({
      totalItems: 1,
      answeredItems: 1,
      correctCount: 1,
      incorrectCount: 0,
      accuracyRate: 1,
      canCheckIn: true,
    })
  })

  it('returns a completed session result for the current user', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/study-sessions/session_123/reviews',
      headers: {
        authorization: 'Bearer valid-token',
        'idempotency-key': 'idem_before_result',
      },
      payload: {
        wordId: 'word_ability',
        questionType: 'word_to_meaning',
        rating: 'good',
        isCorrect: true,
        responseMs: 4200,
        answer: '认识',
        reviewedAt: fixedIso,
      },
    })
    await app.inject({
      method: 'POST',
      url: '/api/v1/study-sessions/session_123/complete',
      headers: {
        authorization: 'Bearer valid-token',
      },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/study-sessions/session_123/result',
      headers: {
        authorization: 'Bearer valid-token',
      },
    })
    const body = studySessionResultResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(200)
    expect(body.result.items[0]).toMatchObject({
      rating: 'good',
      isCorrect: true,
      answer: '认识',
      nextReviewAt: '2026-06-15T00:00:00.000Z',
    })
  })

  it('does not expose a result before the session is completed', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/study-sessions/session_123/reviews',
      headers: {
        authorization: 'Bearer valid-token',
        'idempotency-key': 'idem_before_incomplete_result',
      },
      payload: {
        wordId: 'word_ability',
        questionType: 'word_to_meaning',
        rating: 'good',
        isCorrect: true,
        responseMs: 4200,
        answer: '认识',
        reviewedAt: fixedIso,
      },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/study-sessions/session_123/result',
      headers: {
        authorization: 'Bearer valid-token',
      },
    })
    const body = errorResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('does not expose another user session result', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/study-sessions/session_123/result',
      headers: {
        authorization: 'Bearer other-token',
      },
    })
    const body = errorResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('returns an empty plan state when the user has not created a plan', async () => {
    repository.activePlan = null

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/today',
      headers: {
        authorization: 'Bearer valid-token',
      },
    })
    const body = todayResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(200)
    expect(body.plan).toBeNull()
    expect(body.tasks).toEqual([])
    expect(body.nextSessionRecommendation).toBeNull()
  })
})
