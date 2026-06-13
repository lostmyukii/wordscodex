import type {
  SubmitReviewRequest,
  SubmitReviewResponse,
} from '@wordscodex/contracts'
import { describe, expect, it, vi } from 'vitest'
import { StudyApiError, type StudyClient } from './api'
import type {
  OfflineReviewQueueClient,
  PendingReviewSubmission,
} from './offline-review-queue'
import { syncOfflineReviewQueue } from './offline-review-sync'

const fixedIso = '2026-06-13T08:00:00.000Z'

const review: SubmitReviewRequest = {
  wordId: 'word_ability',
  questionType: 'word_to_meaning',
  rating: 'good',
  isCorrect: true,
  responseMs: 4200,
  answer: '认识',
  reviewedAt: fixedIso,
}

const pendingReview: PendingReviewSubmission = {
  idempotencyKey: 'idem_1',
  sessionId: 'session_123',
  wordId: 'word_ability',
  review,
  createdAt: fixedIso,
  retryCount: 0,
  lastError: null,
  lastAttemptAt: null,
}

const submitReviewResponse: SubmitReviewResponse = {
  progress: {
    masteryState: 'learning',
    repetitions: 1,
    consecutiveCorrect: 1,
    correctCount: 1,
    incorrectCount: 0,
    easeFactor: 2.3,
    intervalDays: 2,
    lastReviewedAt: fixedIso,
    nextReviewAt: '2026-06-15T08:00:00.000Z',
    averageResponseMs: 4200,
    lastErrorType: null,
  },
  alreadyProcessed: false,
}

describe('syncOfflineReviewQueue', () => {
  it('syncs ready pending reviews with their original idempotency keys', async () => {
    const { client, mocks, queue } = createSyncTestDoubles({
      readyReviews: [pendingReview],
      submitReview: vi.fn().mockResolvedValue(submitReviewResponse),
    })

    const result = await syncOfflineReviewQueue({
      queue,
      studyApi: client,
      accessToken: 'access-token',
    })

    expect(result).toEqual({
      status: 'synced',
      syncedCount: 1,
      failedCount: 0,
      lastError: null,
    })
    expect(mocks.submitReview).toHaveBeenCalledWith(
      'session_123',
      review,
      'idem_1',
      'access-token',
    )
    expect(mocks.markSynced).toHaveBeenCalledWith('idem_1')
  })

  it('returns idle when no pending reviews are ready', async () => {
    const { client, mocks, queue } = createSyncTestDoubles({
      readyReviews: [],
    })

    await expect(
      syncOfflineReviewQueue({
        queue,
        studyApi: client,
        accessToken: 'access-token',
      }),
    ).resolves.toEqual({
      status: 'idle',
      syncedCount: 0,
      failedCount: 0,
      lastError: null,
    })
    expect(mocks.submitReview).not.toHaveBeenCalled()
  })

  it('records retry metadata and stops the batch on network failure', async () => {
    const { client, mocks, queue } = createSyncTestDoubles({
      readyReviews: [pendingReview],
      submitReview: vi.fn().mockRejectedValue(new Error('网络连接失败。')),
    })

    const result = await syncOfflineReviewQueue({
      queue,
      studyApi: client,
      accessToken: 'access-token',
    })

    expect(result).toEqual({
      status: 'failed',
      syncedCount: 0,
      failedCount: 1,
      lastError: '网络连接失败。',
    })
    expect(mocks.markFailed).toHaveBeenCalledWith('idem_1', '网络连接失败。')
    expect(mocks.markSynced).not.toHaveBeenCalled()
  })

  it('pauses sync when the access token is unauthorized', async () => {
    const { client, mocks, queue } = createSyncTestDoubles({
      readyReviews: [
        pendingReview,
        {
          ...pendingReview,
          idempotencyKey: 'idem_2',
          wordId: 'word_absorb',
          review: {
            ...review,
            wordId: 'word_absorb',
          },
        },
      ],
      submitReview: vi
        .fn()
        .mockRejectedValue(
          new StudyApiError('UNAUTHORIZED', '登录状态已失效，请重新登录。'),
        ),
    })

    const result = await syncOfflineReviewQueue({
      queue,
      studyApi: client,
      accessToken: 'expired-token',
    })

    expect(result).toEqual({
      status: 'auth_required',
      syncedCount: 0,
      failedCount: 1,
      lastError: '登录状态已失效，请重新登录。',
    })
    expect(mocks.submitReview).toHaveBeenCalledTimes(1)
    expect(mocks.markFailed).toHaveBeenCalledWith(
      'idem_1',
      '登录状态已失效，请重新登录。',
    )
    expect(mocks.markSynced).not.toHaveBeenCalled()
  })
})

function createSyncTestDoubles(input: {
  readyReviews: PendingReviewSubmission[]
  submitReview?: StudyClient['submitReview']
}) {
  const submitReview =
    input.submitReview ?? vi.fn().mockResolvedValue(submitReviewResponse)
  const markFailed = vi.fn().mockResolvedValue(undefined)
  const markSynced = vi.fn().mockResolvedValue(undefined)
  const queue: OfflineReviewQueueClient = {
    enqueue: vi.fn(),
    listBySession: vi.fn().mockResolvedValue([]),
    listReady: vi.fn().mockResolvedValue(input.readyReviews),
    getSummary: vi.fn().mockResolvedValue({
      pendingCount: input.readyReviews.length,
      readyCount: input.readyReviews.length,
      nextRetryAt: null,
      lastError: null,
    }),
    markFailed,
    markSynced,
  }
  const client: StudyClient = {
    getToday: vi.fn(),
    createSession: vi.fn(),
    getSession: vi.fn(),
    submitReview,
    completeSession: vi.fn(),
    getSessionResult: vi.fn(),
  }

  return {
    queue,
    client,
    mocks: {
      markFailed,
      markSynced,
      submitReview,
    },
  }
}
