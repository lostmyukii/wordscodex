import {
  checkinListResponseSchema,
  createCheckinResponseSchema,
  dashboardSummaryResponseSchema,
  dashboardTrendsResponseSchema,
  errorResponseSchema,
  type Checkin,
  type CheckinListResponse,
  type CheckinSummary,
  type CreateCheckinResponse,
  type DashboardSummaryResponse,
  type DashboardTrendsResponse,
  type User,
} from '@wordscodex/contracts'
import {
  buildRecentCheckinDays,
  calculateCurrentStreak,
} from '@wordscodex/domain'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../app.js'
import { AuthServiceError, type AuthService } from '../auth/auth-service.js'
import {
  CheckinNotAllowedError,
  type EngagementRepository,
} from './engagement-routes.js'

const fixedNow = new Date('2026-06-13T08:00:00.000Z')
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

class MemoryEngagementRepository implements EngagementRepository {
  completedSessionsToday = 0
  learnedWords = 12
  masteredWords = 3
  reviewLogs = 20
  checkins = new Map<string, Checkin>()
  createCalls = 0

  listCheckins(input: {
    userId: string
    timezone: string
    now: Date
  }): Promise<CheckinListResponse> {
    return Promise.resolve({
      summary: this.buildSummary(input.now),
      items: [...this.checkins.values()].sort((a, b) =>
        b.dateKey.localeCompare(a.dateKey),
      ),
    })
  }

  createCheckin(input: {
    userId: string
    timezone: string
    now: Date
  }): Promise<CreateCheckinResponse> {
    this.createCalls += 1
    if (this.completedSessionsToday === 0) {
      throw new CheckinNotAllowedError()
    }

    const todayKey = toDateKey(input.now)
    const existing = this.checkins.get(todayKey)
    if (existing) {
      return Promise.resolve({
        checkin: existing,
        summary: this.buildSummary(input.now),
        alreadyCheckedIn: true,
      })
    }

    const checkin: Checkin = {
      id: 'checkin_123',
      dateKey: todayKey,
      checkedInAt: input.now.toISOString(),
      completedSessions: this.completedSessionsToday,
    }
    this.checkins.set(todayKey, checkin)

    return Promise.resolve({
      checkin,
      summary: this.buildSummary(input.now),
      alreadyCheckedIn: false,
    })
  }

  getDashboardSummary(input: {
    userId: string
    timezone: string
    now: Date
  }): Promise<DashboardSummaryResponse> {
    const summary = this.buildSummary(input.now)

    return Promise.resolve({
      plan: null,
      today: {
        dateKey: summary.todayKey,
        completedSessions: this.completedSessionsToday,
        canCheckIn: this.completedSessionsToday > 0,
        checkedInToday: summary.checkedInToday,
      },
      totals: {
        learnedWords: this.learnedWords,
        masteredWords: this.masteredWords,
        reviewLogs: this.reviewLogs,
        checkins: this.checkins.size,
      },
      progress: {
        activeBookName: null,
        totalWords: 0,
        learnedWords: this.learnedWords,
        masteredWords: this.masteredWords,
        dueReviews: 0,
      },
      streak: {
        current: summary.currentStreak,
        recentDays: summary.recentDays,
      },
      generatedAt: input.now.toISOString(),
    })
  }

  getDashboardTrends(input: {
    userId: string
    timezone: string
    now: Date
    days: number
  }): Promise<DashboardTrendsResponse> {
    return Promise.resolve({
      days: buildRecentCheckinDays({
        todayKey: toDateKey(input.now),
        days: input.days,
        checkins: [...this.checkins.values()],
      }).map((day) => ({
        ...day,
        completedSessions: day.checkedIn ? this.completedSessionsToday : 0,
        reviewLogs: day.checkedIn ? this.reviewLogs : 0,
      })),
    })
  }

  private buildSummary(now: Date): CheckinSummary {
    const todayKey = toDateKey(now)
    const items = [...this.checkins.values()]

    return {
      todayKey,
      checkedInToday: this.checkins.has(todayKey),
      currentStreak: calculateCurrentStreak({
        todayKey,
        checkins: items,
      }),
      recentDays: buildRecentCheckinDays({
        todayKey,
        days: 7,
        checkins: items,
      }),
    }
  }
}

function createAuthService(): AuthService {
  return {
    getCurrentUser(accessToken: string) {
      if (accessToken === 'valid-token') return Promise.resolve(user)
      throw new AuthServiceError('UNAUTHORIZED')
    },
  } as unknown as AuthService
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

describe('engagement routes', () => {
  let app: FastifyInstance
  let repository: MemoryEngagementRepository

  beforeEach(() => {
    repository = new MemoryEngagementRepository()
    app = buildApp({
      authService: createAuthService(),
      engagementRepository: repository,
      clock: () => fixedNow,
    })
  })

  afterEach(async () => {
    await app.close()
  })

  it('rejects unauthenticated checkin requests', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/checkins',
    })
    const body = errorResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('rejects checkin before completing a study session today', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/checkins',
      headers: {
        authorization: 'Bearer valid-token',
      },
    })
    const body = errorResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(409)
    expect(body.error.code).toBe('CHECKIN_NOT_ALLOWED')
  })

  it('creates a checkin after a completed study session', async () => {
    repository.completedSessionsToday = 1

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/checkins',
      headers: {
        authorization: 'Bearer valid-token',
      },
    })
    const body = createCheckinResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(201)
    expect(body).toMatchObject({
      alreadyCheckedIn: false,
      checkin: {
        dateKey: '2026-06-13',
        completedSessions: 1,
      },
      summary: {
        checkedInToday: true,
        currentStreak: 1,
      },
    })
  })

  it('returns the same checkin when posting twice', async () => {
    repository.completedSessionsToday = 1

    await app.inject({
      method: 'POST',
      url: '/api/v1/checkins',
      headers: {
        authorization: 'Bearer valid-token',
      },
    })
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/checkins',
      headers: {
        authorization: 'Bearer valid-token',
      },
    })
    const body = createCheckinResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(200)
    expect(body.alreadyCheckedIn).toBe(true)
    expect(repository.checkins.size).toBe(1)
  })

  it('lists checkins with summary', async () => {
    repository.completedSessionsToday = 1
    await app.inject({
      method: 'POST',
      url: '/api/v1/checkins',
      headers: {
        authorization: 'Bearer valid-token',
      },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/checkins',
      headers: {
        authorization: 'Bearer valid-token',
      },
    })
    const body = checkinListResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(200)
    expect(body.items).toHaveLength(1)
    expect(body.summary.checkedInToday).toBe(true)
  })

  it('returns dashboard summary and trends', async () => {
    repository.completedSessionsToday = 1
    await app.inject({
      method: 'POST',
      url: '/api/v1/checkins',
      headers: {
        authorization: 'Bearer valid-token',
      },
    })

    const summaryResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/summary',
      headers: {
        authorization: 'Bearer valid-token',
      },
    })
    const summary = dashboardSummaryResponseSchema.parse(summaryResponse.json())

    const trendsResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/dashboard/trends?days=7',
      headers: {
        authorization: 'Bearer valid-token',
      },
    })
    const trends = dashboardTrendsResponseSchema.parse(trendsResponse.json())

    expect(summaryResponse.statusCode).toBe(200)
    expect(summary.today).toMatchObject({
      canCheckIn: true,
      checkedInToday: true,
    })
    expect(summary.streak.current).toBe(1)
    expect(trendsResponse.statusCode).toBe(200)
    expect(trends.days).toHaveLength(7)
  })
})
