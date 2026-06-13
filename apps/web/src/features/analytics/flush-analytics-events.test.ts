import type { CreateAnalyticsEventResponse } from '@wordscodex/contracts'
import { describe, expect, it, vi } from 'vitest'
import type { AnalyticsClient } from './track-event'
import { flushAnalyticsEventQueue } from './flush-analytics-events'
import type {
  AnalyticsEventQueueClient,
  PendingAnalyticsEvent,
} from './analytics-event-queue'

const fixedIso = '2026-06-13T08:00:00.000Z'

describe('flushAnalyticsEventQueue', () => {
  it('sends ready analytics events sequentially and deletes sent records', async () => {
    const first = createPendingEvent('event_1')
    const second = createPendingEvent('event_2')
    const listReady = vi.fn().mockResolvedValue([first, second])
    const markSent = vi.fn().mockResolvedValue(undefined)
    const queue = createQueue({ listReady, markSent })
    const send = vi.fn().mockResolvedValue(createResponse())
    const client: AnalyticsClient = {
      send,
    }

    await expect(
      flushAnalyticsEventQueue({
        queue,
        client,
        accessToken: 'access-token',
        limit: 10,
      }),
    ).resolves.toEqual({
      status: 'flushed',
      sentCount: 2,
      failedCount: 0,
      lastError: null,
    })

    expect(listReady).toHaveBeenCalledWith(10)
    expect(send).toHaveBeenNthCalledWith(1, toPayload(first), 'access-token')
    expect(send).toHaveBeenNthCalledWith(2, toPayload(second), 'access-token')
    expect(markSent).toHaveBeenNthCalledWith(1, 'event_1')
    expect(markSent).toHaveBeenNthCalledWith(2, 'event_2')
  })

  it('records retry metadata and stops after the first send failure', async () => {
    const first = createPendingEvent('event_1')
    const second = createPendingEvent('event_2')
    const markFailed = vi.fn().mockResolvedValue(undefined)
    const markSent = vi.fn().mockResolvedValue(undefined)
    const queue = createQueue({
      listReady: vi.fn().mockResolvedValue([first, second]),
      markFailed,
      markSent,
    })
    const send = vi.fn().mockRejectedValue(new Error('服务暂时不可用。'))
    const client: AnalyticsClient = {
      send,
    }

    await expect(
      flushAnalyticsEventQueue({
        queue,
        client,
      }),
    ).resolves.toEqual({
      status: 'failed',
      sentCount: 0,
      failedCount: 1,
      lastError: '服务暂时不可用。',
    })

    expect(send).toHaveBeenCalledTimes(1)
    expect(markFailed).toHaveBeenCalledWith('event_1', '服务暂时不可用。')
    expect(markSent).not.toHaveBeenCalled()
  })
})

function createPendingEvent(clientEventId: string): PendingAnalyticsEvent {
  return {
    clientEventId,
    name: 'offline_queue_created',
    occurredAt: fixedIso,
    properties: {
      pendingCount: 1,
    },
    retryCount: 0,
    lastError: null,
    lastAttemptAt: null,
  }
}

function createQueue(input: {
  listReady?: AnalyticsEventQueueClient['listReady']
  markFailed?: AnalyticsEventQueueClient['markFailed']
  markSent?: AnalyticsEventQueueClient['markSent']
}): AnalyticsEventQueueClient {
  return {
    enqueue: vi.fn(),
    listReady: input.listReady ?? vi.fn().mockResolvedValue([]),
    markFailed: input.markFailed ?? vi.fn().mockResolvedValue(undefined),
    markSent: input.markSent ?? vi.fn().mockResolvedValue(undefined),
  }
}

function createResponse(): CreateAnalyticsEventResponse {
  return {
    accepted: true,
    eventId: 'analytics_1',
    alreadyProcessed: false,
  }
}

function toPayload(event: PendingAnalyticsEvent) {
  return {
    clientEventId: event.clientEventId,
    name: event.name,
    occurredAt: event.occurredAt,
    properties: event.properties,
  }
}
