import { analyticsApi } from './api'
import {
  analyticsEventQueue,
  type AnalyticsEventQueueClient,
} from './analytics-event-queue'
import type { AnalyticsClient } from './track-event'

type FlushAnalyticsEventQueueOptions = {
  queue?: AnalyticsEventQueueClient
  client?: AnalyticsClient
  accessToken?: string
  limit?: number
}

type FlushAnalyticsEventQueueStatus = 'idle' | 'flushed' | 'failed'

export type FlushAnalyticsEventQueueResult = {
  status: FlushAnalyticsEventQueueStatus
  sentCount: number
  failedCount: number
  lastError: string | null
}

export async function flushAnalyticsEventQueue({
  queue = analyticsEventQueue,
  client = analyticsApi,
  accessToken,
  limit = 20,
}: FlushAnalyticsEventQueueOptions = {}): Promise<FlushAnalyticsEventQueueResult> {
  const events = await queue.listReady(limit)

  if (events.length === 0) {
    return {
      status: 'idle',
      sentCount: 0,
      failedCount: 0,
      lastError: null,
    }
  }

  let sentCount = 0

  for (const event of events) {
    const payload = {
      clientEventId: event.clientEventId,
      name: event.name,
      occurredAt: event.occurredAt,
      properties: event.properties,
    }

    try {
      await client.send(payload, accessToken)
      await queue.markSent(event.clientEventId)
      sentCount += 1
    } catch (error) {
      const message = getErrorMessage(error)
      await queue.markFailed(event.clientEventId, message)
      return {
        status: 'failed',
        sentCount,
        failedCount: 1,
        lastError: message,
      }
    }
  }

  return {
    status: 'flushed',
    sentCount,
    failedCount: 0,
    lastError: null,
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : '埋点批量同步失败，请稍后重试。'
}
