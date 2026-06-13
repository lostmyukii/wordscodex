import { act, render, waitFor } from '@testing-library/react'
import type { SubmitReviewResponse } from '@wordscodex/contracts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  analyticsFlushSyncTag,
  backgroundSyncMessageType,
  offlineReviewSyncTag,
} from './background-sync'
import { BackgroundSyncController } from './BackgroundSyncController'
import { analyticsEventQueuedEventName } from '../features/analytics/track-event'
import { useAuthStore } from '../features/auth/auth-store'
import type { StudyClient } from '../features/study/api'
import {
  offlineReviewQueueChangedEventName,
  type OfflineReviewQueueClient,
  type PendingReviewSubmission,
} from '../features/study/offline-review-queue'
import { offlineReviewSyncCompletedEventName } from '../features/study/offline-review-sync'

const fixedIso = '2026-06-13T08:00:00.000Z'

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

describe('BackgroundSyncController', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'access-token',
      user: {
        id: 'user_123',
        email: null,
        displayName: '学习者',
        role: 'learner',
        accountType: 'guest',
        timezone: 'Asia/Shanghai',
        createdAt: fixedIso,
        updatedAt: fixedIso,
      },
      initialized: true,
    })
  })

  it('registers background sync tags when local queues change', async () => {
    const eventTarget = new EventTarget()
    const registerSync = vi.fn().mockResolvedValue({
      status: 'registered',
      tag: analyticsFlushSyncTag,
    })

    render(
      <BackgroundSyncController
        eventTarget={eventTarget}
        flushAnalytics={vi.fn().mockResolvedValue({ status: 'idle' })}
        isOnline={() => true}
        registerSync={registerSync}
        reviewQueue={createReviewQueue([])}
        studyApi={createStudyClient()}
      />,
    )

    act(() => {
      eventTarget.dispatchEvent(new Event(analyticsEventQueuedEventName))
      eventTarget.dispatchEvent(new Event(offlineReviewQueueChangedEventName))
    })

    await waitFor(() => {
      expect(registerSync).toHaveBeenCalledWith(analyticsFlushSyncTag)
      expect(registerSync).toHaveBeenCalledWith(offlineReviewSyncTag)
    })
  })

  it('flushes analytics and reviews when the service worker sends sync messages', async () => {
    const eventTarget = new EventTarget()
    const flushAnalytics = vi.fn().mockResolvedValue({
      status: 'flushed',
      sentCount: 1,
      failedCount: 0,
      lastError: null,
    })
    const pendingReview = createPendingReview()
    const markSynced = vi.fn().mockResolvedValue(undefined)
    const reviewQueue = createReviewQueue([pendingReview], { markSynced })
    const submitReview = vi.fn().mockResolvedValue(submitReviewResponse)
    const studyApi = createStudyClient({ submitReview })
    const completedEvents: number[] = []
    eventTarget.addEventListener(offlineReviewSyncCompletedEventName, () => {
      completedEvents.push(1)
    })

    render(
      <BackgroundSyncController
        eventTarget={eventTarget}
        flushAnalytics={flushAnalytics}
        isOnline={() => true}
        registerSync={vi.fn().mockResolvedValue({ status: 'registered' })}
        reviewQueue={reviewQueue}
        studyApi={studyApi}
      />,
    )

    act(() => {
      eventTarget.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: backgroundSyncMessageType,
            tag: analyticsFlushSyncTag,
          },
        }),
      )
      eventTarget.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: backgroundSyncMessageType,
            tag: offlineReviewSyncTag,
          },
        }),
      )
    })

    await waitFor(() => {
      expect(flushAnalytics).toHaveBeenCalledWith({
        accessToken: 'access-token',
      })
      expect(submitReview).toHaveBeenCalledWith(
        'session_123',
        pendingReview.review,
        'idem_1',
        'access-token',
      )
      expect(markSynced).toHaveBeenCalledWith('idem_1')
      expect(completedEvents).toHaveLength(1)
    })
  })
})

function createPendingReview(): PendingReviewSubmission {
  return {
    idempotencyKey: 'idem_1',
    sessionId: 'session_123',
    wordId: 'word_ability',
    review: {
      wordId: 'word_ability',
      questionType: 'word_to_meaning',
      rating: 'good',
      isCorrect: true,
      responseMs: 4200,
      answer: '认识',
      reviewedAt: fixedIso,
    },
    createdAt: fixedIso,
    retryCount: 0,
    lastError: null,
    lastAttemptAt: null,
  }
}

function createReviewQueue(
  readyReviews: PendingReviewSubmission[],
  input: {
    markSynced?: OfflineReviewQueueClient['markSynced']
  } = {},
): OfflineReviewQueueClient {
  return {
    enqueue: vi.fn(),
    listBySession: vi.fn().mockResolvedValue([]),
    listReady: vi.fn().mockResolvedValue(readyReviews),
    getSummary: vi.fn().mockResolvedValue({
      pendingCount: readyReviews.length,
      readyCount: readyReviews.length,
      nextRetryAt: null,
      lastError: null,
    }),
    markFailed: vi.fn().mockResolvedValue(undefined),
    markSynced: input.markSynced ?? vi.fn().mockResolvedValue(undefined),
  }
}

function createStudyClient(
  input: {
    submitReview?: StudyClient['submitReview']
  } = {},
): StudyClient {
  return {
    getToday: vi.fn(),
    createSession: vi.fn(),
    getSession: vi.fn(),
    submitReview:
      input.submitReview ?? vi.fn().mockResolvedValue(submitReviewResponse),
    completeSession: vi.fn(),
    getSessionResult: vi.fn(),
  }
}
