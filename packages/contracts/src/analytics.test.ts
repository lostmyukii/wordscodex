import { describe, expect, it } from 'vitest'
import {
  analyticsEventNameSchema,
  analyticsSummaryQuerySchema,
  analyticsSummaryResponseSchema,
  createAnalyticsEventRequestSchema,
  createAnalyticsEventResponseSchema,
} from './analytics.js'

describe('analytics contracts', () => {
  it('accepts a privacy-safe PWA event payload', () => {
    const parsed = createAnalyticsEventRequestSchema.parse({
      clientEventId: 'event_123',
      name: 'pwa_install_prompt_shown',
      occurredAt: '2026-06-13T08:00:00.000Z',
      properties: {
        source: 'beforeinstallprompt',
        pendingCount: 1,
        updateReady: true,
      },
    })

    expect(parsed).toMatchObject({
      clientEventId: 'event_123',
      name: 'pwa_install_prompt_shown',
      properties: {
        source: 'beforeinstallprompt',
      },
    })
  })

  it('rejects properties that could contain private learner data', () => {
    expect(() =>
      createAnalyticsEventRequestSchema.parse({
        clientEventId: 'event_123',
        name: 'review_answered',
        occurredAt: '2026-06-13T08:00:00.000Z',
        properties: {
          answer: '完整作答文本不能进入埋点。',
        },
      }),
    ).toThrow()
    expect(() =>
      createAnalyticsEventRequestSchema.parse({
        clientEventId: 'event_124',
        name: 'auth_completed',
        occurredAt: '2026-06-13T08:00:00.000Z',
        properties: {
          email: 'learner@example.com',
        },
      }),
    ).toThrow()
  })

  it('keeps Stage 3 PWA and offline event names stable', () => {
    expect(analyticsEventNameSchema.parse('pwa_installed')).toBe(
      'pwa_installed',
    )
    expect(analyticsEventNameSchema.parse('offline_queue_created')).toBe(
      'offline_queue_created',
    )
    expect(analyticsEventNameSchema.parse('offline_queue_synced')).toBe(
      'offline_queue_synced',
    )
  })

  it('returns an idempotent accepted response', () => {
    expect(
      createAnalyticsEventResponseSchema.parse({
        accepted: true,
        eventId: 'analytics_123',
        alreadyProcessed: true,
      }),
    ).toMatchObject({
      accepted: true,
      alreadyProcessed: true,
    })
  })

  it('parses analytics summary query defaults and bounds', () => {
    expect(analyticsSummaryQuerySchema.parse({})).toEqual({ days: 7 })
    expect(analyticsSummaryQuerySchema.parse({ days: '30' })).toEqual({
      days: 30,
    })
    expect(() => analyticsSummaryQuerySchema.parse({ days: '91' })).toThrow()
  })

  it('returns aggregate analytics summary without raw event payloads', () => {
    expect(
      analyticsSummaryResponseSchema.parse({
        days: 7,
        totalEvents: 5,
        uniqueUsers: 2,
        anonymousEvents: 1,
        events: [
          {
            name: 'offline_queue_synced',
            count: 3,
          },
          {
            name: 'pwa_installed',
            count: 2,
          },
        ],
      }),
    ).toEqual({
      days: 7,
      totalEvents: 5,
      uniqueUsers: 2,
      anonymousEvents: 1,
      events: [
        {
          name: 'offline_queue_synced',
          count: 3,
        },
        {
          name: 'pwa_installed',
          count: 2,
        },
      ],
    })
  })
})
