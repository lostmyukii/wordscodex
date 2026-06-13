import { StudyApiError, studyApi, type StudyClient } from './api'
import {
  offlineReviewQueue,
  type OfflineReviewQueueClient,
} from './offline-review-queue'

export const offlineReviewSyncCompletedEventName =
  'wordscodex:offline-review-sync-completed'

type OfflineReviewSyncStatus = 'idle' | 'synced' | 'failed' | 'auth_required'

export type OfflineReviewSyncResult = {
  status: OfflineReviewSyncStatus
  syncedCount: number
  failedCount: number
  lastError: string | null
}

export async function syncOfflineReviewQueue(input: {
  queue?: OfflineReviewQueueClient
  studyApi?: StudyClient
  accessToken: string
  limit?: number
}): Promise<OfflineReviewSyncResult> {
  const queue = input.queue ?? offlineReviewQueue
  const client = input.studyApi ?? studyApi
  const pendingReviews = await queue.listReady(input.limit ?? 20)

  if (pendingReviews.length === 0) {
    return {
      status: 'idle',
      syncedCount: 0,
      failedCount: 0,
      lastError: null,
    }
  }

  let syncedCount = 0

  for (const pendingReview of pendingReviews) {
    try {
      await client.submitReview(
        pendingReview.sessionId,
        pendingReview.review,
        pendingReview.idempotencyKey,
        input.accessToken,
      )
      await queue.markSynced(pendingReview.idempotencyKey)
      syncedCount += 1
    } catch (error) {
      const message = getErrorMessage(error)
      await queue.markFailed(pendingReview.idempotencyKey, message)

      return {
        status: isAuthRequiredError(error) ? 'auth_required' : 'failed',
        syncedCount,
        failedCount: 1,
        lastError: message,
      }
    }
  }

  return {
    status: 'synced',
    syncedCount,
    failedCount: 0,
    lastError: null,
  }
}

function isAuthRequiredError(error: unknown) {
  return error instanceof StudyApiError && error.code === 'UNAUTHORIZED'
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : '离线作答同步失败，请稍后重试。'
}
