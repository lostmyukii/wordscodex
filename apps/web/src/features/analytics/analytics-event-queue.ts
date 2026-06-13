import Dexie, { type Table } from 'dexie'
import {
  createAnalyticsEventRequestSchema,
  type CreateAnalyticsEventRequest,
} from '@wordscodex/contracts'
import {
  offlineDatabaseName,
  offlineDatabaseStores,
} from '../study/offline-database-schema'

export type PendingAnalyticsEvent = CreateAnalyticsEventRequest & {
  retryCount: number
  lastError: string | null
  lastAttemptAt: string | null
}

type AnalyticsEventQueueOptions = {
  databaseName?: string
  now?: () => Date
}

export type AnalyticsEventQueueClient = {
  enqueue(
    input: CreateAnalyticsEventRequest & {
      lastError: string | null
    },
  ): Promise<PendingAnalyticsEvent>
  listReady(limit?: number): Promise<PendingAnalyticsEvent[]>
  markFailed(clientEventId: string, errorMessage: string): Promise<void>
  markSent(clientEventId: string): Promise<void>
}

class AnalyticsEventQueueDatabase extends Dexie {
  analyticsEvents!: Table<PendingAnalyticsEvent, string>

  constructor(databaseName: string) {
    super(databaseName)
    this.version(1).stores(offlineDatabaseStores)
    this.version(2).stores(offlineDatabaseStores)
    this.version(3).stores(offlineDatabaseStores)
  }
}

export class AnalyticsEventQueue implements AnalyticsEventQueueClient {
  private readonly database: AnalyticsEventQueueDatabase
  private readonly now: () => Date

  constructor(options: AnalyticsEventQueueOptions = {}) {
    this.database = new AnalyticsEventQueueDatabase(
      options.databaseName ?? offlineDatabaseName,
    )
    this.now = options.now ?? (() => new Date())
  }

  async enqueue(
    input: CreateAnalyticsEventRequest & {
      lastError: string | null
    },
  ) {
    const payload = createAnalyticsEventRequestSchema.parse(input)
    const existing = await this.database.analyticsEvents.get(
      payload.clientEventId,
    )
    const event: PendingAnalyticsEvent = {
      ...payload,
      retryCount: existing?.retryCount ?? 0,
      lastError: input.lastError,
      lastAttemptAt: existing?.lastAttemptAt ?? null,
    }

    await this.database.analyticsEvents.put(event)

    return event
  }

  async listReady(limit = 20) {
    const nowMs = this.now().getTime()
    const records = await this.database.analyticsEvents.toArray()
    return records
      .filter((event) => isReady(event, nowMs))
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
      .slice(0, limit)
  }

  async markFailed(clientEventId: string, errorMessage: string) {
    const existing = await this.database.analyticsEvents.get(clientEventId)
    if (!existing) return

    await this.database.analyticsEvents.put({
      ...existing,
      retryCount: existing.retryCount + 1,
      lastError: errorMessage,
      lastAttemptAt: this.now().toISOString(),
    })
  }

  async markSent(clientEventId: string) {
    await this.database.analyticsEvents.delete(clientEventId)
  }
}

export const analyticsEventQueue = new AnalyticsEventQueue()

function isReady(event: PendingAnalyticsEvent, nowMs: number) {
  if (!event.lastAttemptAt) return true

  const retryDelayMs = Math.min(60, 2 ** event.retryCount) * 60 * 1000
  return new Date(event.lastAttemptAt).getTime() + retryDelayMs <= nowMs
}
