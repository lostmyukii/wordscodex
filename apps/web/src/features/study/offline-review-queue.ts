import Dexie, { type Table } from 'dexie'
import type { SubmitReviewRequest } from '@wordscodex/contracts'
import {
  isOfflineReviewOperationReady,
  markOfflineReviewOperationFailed,
  selectPendingOfflineReviewOperations,
  upsertOfflineReviewOperation,
  type OfflineReviewOperation,
} from '@wordscodex/domain'
import {
  offlineDatabaseName,
  offlineDatabaseStores,
} from './offline-database-schema'

export const offlineReviewQueueChangedEventName =
  'wordscodex:offline-review-queue-changed'

export type PendingReviewSubmission = OfflineReviewOperation & {
  review: SubmitReviewRequest
}

type OfflineReviewQueueOptions = {
  databaseName?: string
  now?: () => Date
}

export type OfflineReviewQueueSummary = {
  pendingCount: number
  readyCount: number
  nextRetryAt: string | null
  lastError: string | null
}

export type OfflineReviewQueueClient = {
  enqueue(input: {
    sessionId: string
    idempotencyKey: string
    review: SubmitReviewRequest
    createdAt?: string
    lastError: string | null
  }): Promise<PendingReviewSubmission>
  listBySession(sessionId: string): Promise<PendingReviewSubmission[]>
  listReady(limit?: number): Promise<PendingReviewSubmission[]>
  getSummary(): Promise<OfflineReviewQueueSummary>
  markFailed(idempotencyKey: string, errorMessage: string): Promise<void>
  markSynced(idempotencyKey: string): Promise<void>
}

class OfflineReviewQueueDatabase extends Dexie {
  pendingReviews!: Table<PendingReviewSubmission, string>

  constructor(databaseName: string) {
    super(databaseName)
    this.version(1).stores(offlineDatabaseStores)
    this.version(2).stores(offlineDatabaseStores)
    this.version(3).stores(offlineDatabaseStores)
  }
}

export class OfflineReviewQueue implements OfflineReviewQueueClient {
  private readonly database: OfflineReviewQueueDatabase
  private readonly now: () => Date

  constructor(options: OfflineReviewQueueOptions = {}) {
    this.database = new OfflineReviewQueueDatabase(
      options.databaseName ?? offlineDatabaseName,
    )
    this.now = options.now ?? (() => new Date())
  }

  async enqueue(input: {
    sessionId: string
    idempotencyKey: string
    review: SubmitReviewRequest
    createdAt?: string
    lastError: string | null
  }) {
    const existing = await this.database.pendingReviews
      .where('sessionId')
      .equals(input.sessionId)
      .toArray()
    const operation: PendingReviewSubmission = {
      idempotencyKey: input.idempotencyKey,
      sessionId: input.sessionId,
      wordId: input.review.wordId,
      review: input.review,
      createdAt: input.createdAt ?? this.now().toISOString(),
      retryCount: 0,
      lastError: input.lastError,
      lastAttemptAt: null,
    }
    const nextQueue = upsertOfflineReviewOperation({
      queue: existing,
      operation,
    })
    const nextOperation =
      nextQueue.find((item) => item.idempotencyKey === input.idempotencyKey) ??
      operation
    const nextSubmission: PendingReviewSubmission = {
      ...nextOperation,
      review: input.review,
    }

    await this.database.pendingReviews.put(nextSubmission)

    return nextSubmission
  }

  async listBySession(sessionId: string) {
    const records = await this.database.pendingReviews
      .where('sessionId')
      .equals(sessionId)
      .toArray()

    return selectPendingOfflineReviewOperations({
      queue: records,
      limit: records.length,
    }) as PendingReviewSubmission[]
  }

  async listReady(limit = 20) {
    const now = this.now().toISOString()
    const records = await this.database.pendingReviews.toArray()
    const readyRecords = records.filter((operation) =>
      isOfflineReviewOperationReady({
        operation,
        now,
      }),
    )

    return selectPendingOfflineReviewOperations({
      queue: readyRecords,
      limit,
    }) as PendingReviewSubmission[]
  }

  async getSummary(): Promise<OfflineReviewQueueSummary> {
    const now = this.now().toISOString()
    const records = await this.database.pendingReviews.toArray()
    const readyCount = records.filter((operation) =>
      isOfflineReviewOperationReady({
        operation,
        now,
      }),
    ).length
    const nextRetryAt = records
      .map(nextRetryIso)
      .filter((value): value is string => Boolean(value))
      .sort((left, right) => left.localeCompare(right))[0]
    const lastError =
      [...records]
        .filter((operation) => operation.lastError)
        .sort((left, right) =>
          (right.lastAttemptAt ?? right.createdAt).localeCompare(
            left.lastAttemptAt ?? left.createdAt,
          ),
        )[0]?.lastError ?? null

    return {
      pendingCount: records.length,
      readyCount,
      nextRetryAt: nextRetryAt ?? null,
      lastError,
    }
  }

  async markFailed(idempotencyKey: string, errorMessage: string) {
    const existing = await this.database.pendingReviews.get(idempotencyKey)
    if (!existing) return

    await this.database.pendingReviews.put({
      ...existing,
      ...markOfflineReviewOperationFailed({
        operation: existing,
        errorMessage,
        attemptedAt: this.now().toISOString(),
      }),
    })
  }

  async markSynced(idempotencyKey: string) {
    await this.database.pendingReviews.delete(idempotencyKey)
  }
}

export const offlineReviewQueue = new OfflineReviewQueue()

function nextRetryIso(operation: PendingReviewSubmission) {
  if (!operation.lastAttemptAt) return null

  const retryDelayMs = Math.min(
    30 * 60_000,
    60_000 * 2 ** Math.max(0, operation.retryCount - 1),
  )
  return new Date(
    new Date(operation.lastAttemptAt).getTime() + retryDelayMs,
  ).toISOString()
}
