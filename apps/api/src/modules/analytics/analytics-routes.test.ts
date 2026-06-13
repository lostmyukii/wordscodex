import {
  analyticsSummaryResponseSchema,
  createAnalyticsEventRequestSchema,
  createAnalyticsEventResponseSchema,
  errorResponseSchema,
  type AnalyticsSummaryResponse,
  type CreateAnalyticsEventRequest,
  type User,
} from '@wordscodex/contracts'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../app.js'
import { AuthServiceError, type AuthService } from '../auth/auth-service.js'
import type { AnalyticsRepository } from './analytics-routes.js'

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

class MemoryAnalyticsRepository implements AnalyticsRepository {
  events = new Map<
    string,
    CreateAnalyticsEventRequest & {
      eventId: string
      userId: string | null
    }
  >()

  recordEvent(input: CreateAnalyticsEventRequest & { userId: string | null }) {
    const existing = this.events.get(input.clientEventId)
    if (existing) {
      return Promise.resolve({
        accepted: true as const,
        eventId: existing.eventId,
        alreadyProcessed: true,
      })
    }

    const event = {
      ...input,
      eventId: `analytics_${this.events.size + 1}`,
    }
    this.events.set(input.clientEventId, event)

    return Promise.resolve({
      accepted: true as const,
      eventId: event.eventId,
      alreadyProcessed: false,
    })
  }

  getSummary(input: { days: number; now: Date }) {
    const since = new Date(input.now.getTime() - input.days * 24 * 60 * 60_000)
    const events = [...this.events.values()].filter(
      (event) => new Date(event.occurredAt).getTime() >= since.getTime(),
    )
    const grouped = new Map<string, number>()

    for (const event of events) {
      grouped.set(event.name, (grouped.get(event.name) ?? 0) + 1)
    }

    const response: AnalyticsSummaryResponse = {
      days: input.days,
      totalEvents: events.length,
      uniqueUsers: new Set(
        events.flatMap((event) => (event.userId ? [event.userId] : [])),
      ).size,
      anonymousEvents: events.filter((event) => !event.userId).length,
      events: [...grouped.entries()]
        .map(([name, count]) => ({
          name: createAnalyticsEventRequestSchema.shape.name.parse(name),
          count,
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    }

    return Promise.resolve(response)
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

describe('analytics routes', () => {
  let app: FastifyInstance
  let repository: MemoryAnalyticsRepository

  beforeEach(() => {
    repository = new MemoryAnalyticsRepository()
    app = buildApp({
      authService: createAuthService(),
      analyticsRepository: repository,
      clock: () => fixedNow,
    })
  })

  afterEach(async () => {
    await app.close()
  })

  it('records an anonymous PWA analytics event', async () => {
    const payload = createAnalyticsEventRequestSchema.parse({
      clientEventId: 'event_pwa_prompt',
      name: 'pwa_install_prompt_shown',
      occurredAt: fixedIso,
      properties: {
        source: 'beforeinstallprompt',
      },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/analytics/events',
      payload,
    })
    const body = createAnalyticsEventResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(201)
    expect(body).toMatchObject({
      accepted: true,
      alreadyProcessed: false,
    })
    expect(repository.events.get('event_pwa_prompt')).toMatchObject({
      userId: null,
      name: 'pwa_install_prompt_shown',
    })
  })

  it('attaches the current user when a bearer token is present', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/analytics/events',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        clientEventId: 'event_sync',
        name: 'offline_queue_synced',
        occurredAt: fixedIso,
        properties: {
          syncedCount: 2,
        },
      },
    })

    expect(response.statusCode).toBe(201)
    expect(repository.events.get('event_sync')).toMatchObject({
      userId: 'user_123',
    })
  })

  it('is idempotent by client event id', async () => {
    const payload = {
      clientEventId: 'event_duplicate',
      name: 'offline_queue_created',
      occurredAt: fixedIso,
      properties: {
        pendingCount: 1,
      },
    }

    await app.inject({
      method: 'POST',
      url: '/api/v1/analytics/events',
      payload,
    })
    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/v1/analytics/events',
      payload,
    })
    const body = createAnalyticsEventResponseSchema.parse(duplicate.json())

    expect(duplicate.statusCode).toBe(200)
    expect(body.alreadyProcessed).toBe(true)
    expect(repository.events).toHaveLength(1)
  })

  it('rejects private analytics properties', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/analytics/events',
      payload: {
        clientEventId: 'event_private',
        name: 'review_answered',
        occurredAt: fixedIso,
        properties: {
          answer: '完整作答文本不能进入埋点。',
        },
      },
    })
    const body = errorResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(400)
    expect(body.error.code).toBe('VALIDATION_FAILED')
  })

  it('rejects an invalid bearer token instead of silently anonymizing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/analytics/events',
      headers: {
        authorization: 'Bearer expired-token',
      },
      payload: {
        clientEventId: 'event_invalid_auth',
        name: 'offline_queue_synced',
        occurredAt: fixedIso,
        properties: {},
      },
    })
    const body = errorResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns an authenticated aggregate summary without raw event payloads', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/v1/analytics/events',
      payload: {
        clientEventId: 'event_anonymous',
        name: 'pwa_installed',
        occurredAt: fixedIso,
        properties: {
          source: 'browser',
        },
      },
    })
    await app.inject({
      method: 'POST',
      url: '/api/v1/analytics/events',
      headers: {
        authorization: 'Bearer valid-token',
      },
      payload: {
        clientEventId: 'event_user_sync',
        name: 'offline_queue_synced',
        occurredAt: fixedIso,
        properties: {
          syncedCount: 2,
        },
      },
    })

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/summary?days=7',
      headers: {
        authorization: 'Bearer valid-token',
      },
    })
    const body = analyticsSummaryResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(200)
    expect(body).toMatchObject({
      days: 7,
      totalEvents: 2,
      uniqueUsers: 1,
      anonymousEvents: 1,
    })
    expect(body.events).toEqual([
      {
        name: 'offline_queue_synced',
        count: 1,
      },
      {
        name: 'pwa_installed',
        count: 1,
      },
    ])
    expect(JSON.stringify(body)).not.toContain('syncedCount')
  })

  it('rejects analytics summary requests without a valid bearer token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/analytics/summary',
      headers: {
        authorization: 'Bearer expired-token',
      },
    })
    const body = errorResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(401)
    expect(body.error.code).toBe('UNAUTHORIZED')
  })
})
