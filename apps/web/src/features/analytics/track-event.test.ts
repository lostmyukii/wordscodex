import type { CreateAnalyticsEventRequest } from '@wordscodex/contracts'
import { describe, expect, it, vi } from 'vitest'
import {
  analyticsEventQueuedEventName,
  trackAnalyticsEvent,
  type AnalyticsClient,
  type AnalyticsEventQueueClient,
} from './track-event'

const fixedIso = '2026-06-13T08:00:00.000Z'

describe('trackAnalyticsEvent', () => {
  it('sends the event immediately when online', async () => {
    const send = vi.fn().mockResolvedValue({
      accepted: true,
      eventId: 'analytics_1',
      alreadyProcessed: false,
    })
    const client: AnalyticsClient = {
      send,
    }
    const { enqueue, queue } = createQueue()

    await expect(
      trackAnalyticsEvent({
        client,
        queue,
        accessToken: 'access-token',
        createEventId: () => 'event_1',
        isOnline: () => true,
        now: () => new Date(fixedIso),
        name: 'pwa_install_prompt_shown',
        properties: {
          source: 'beforeinstallprompt',
        },
      }),
    ).resolves.toEqual({ status: 'sent' })

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        clientEventId: 'event_1',
        name: 'pwa_install_prompt_shown',
      }),
      'access-token',
    )
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('queues the event when sending fails or the browser is offline', async () => {
    const failedEventQueue = createQueue()
    const offlineEventQueue = createQueue()
    const failedEventTarget = new EventTarget()
    const offlineEventTarget = new EventTarget()
    const failedQueueEvents: string[] = []
    const offlineQueueEvents: string[] = []
    failedEventTarget.addEventListener(analyticsEventQueuedEventName, () => {
      failedQueueEvents.push('queued')
    })
    offlineEventTarget.addEventListener(analyticsEventQueuedEventName, () => {
      offlineQueueEvents.push('queued')
    })
    const failingSend = vi.fn().mockRejectedValue(new Error('网络连接失败。'))
    const unusedSend = vi.fn()
    const failingClient: AnalyticsClient = {
      send: failingSend,
    }
    const unusedClient: AnalyticsClient = {
      send: unusedSend,
    }

    await expect(
      trackAnalyticsEvent({
        client: failingClient,
        queue: failedEventQueue.queue,
        createEventId: () => 'event_failed',
        eventTarget: failedEventTarget,
        isOnline: () => true,
        now: () => new Date(fixedIso),
        name: 'offline_queue_synced',
        properties: {
          syncedCount: 1,
        },
      }),
    ).resolves.toEqual({ status: 'queued' })
    await expect(
      trackAnalyticsEvent({
        client: unusedClient,
        queue: offlineEventQueue.queue,
        createEventId: () => 'event_offline',
        eventTarget: offlineEventTarget,
        isOnline: () => false,
        now: () => new Date(fixedIso),
        name: 'offline_queue_created',
        properties: {
          pendingCount: 1,
        },
      }),
    ).resolves.toEqual({ status: 'queued' })

    expect(failedEventQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        clientEventId: 'event_failed',
        lastError: '网络连接失败。',
      }),
    )
    expect(unusedSend).not.toHaveBeenCalled()
    expect(offlineEventQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        clientEventId: 'event_offline',
        lastError: '浏览器离线，埋点已暂存。',
      }),
    )
    expect(failedQueueEvents).toEqual(['queued'])
    expect(offlineQueueEvents).toEqual(['queued'])
  })
})

function createQueue() {
  const enqueue = vi.fn((input: CreateAnalyticsEventRequest) =>
    Promise.resolve({
      ...input,
      retryCount: 0,
      lastError: null,
      lastAttemptAt: null,
    }),
  )
  const queue: AnalyticsEventQueueClient = {
    enqueue,
    listReady: vi.fn().mockResolvedValue([]),
    markFailed: vi.fn().mockResolvedValue(undefined),
    markSent: vi.fn().mockResolvedValue(undefined),
  }

  return {
    queue,
    enqueue,
  }
}
