import { act, render, screen, waitFor } from '@testing-library/react'
import type {
  SubmitReviewRequest,
  SubmitReviewResponse,
} from '@wordscodex/contracts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../auth/auth-store'
import { StudyApiError, type StudyClient } from './api'
import { OfflineReviewSyncStatus } from './OfflineReviewSyncStatus'
import type {
  OfflineReviewQueueClient,
  PendingReviewSubmission,
} from './offline-review-queue'

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

describe('OfflineReviewSyncStatus', () => {
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

  it('syncs ready reviews when the browser comes back online', async () => {
    let isOnline = false
    const eventTarget = new EventTarget()
    const trackEvent = vi.fn().mockResolvedValue(undefined)
    const { client, mocks, queue } = createComponentTestDoubles({
      readyReviews: [pendingReview],
    })

    render(
      <OfflineReviewSyncStatus
        eventTarget={eventTarget}
        isOnline={() => isOnline}
        queue={queue}
        studyApi={client}
        trackEvent={trackEvent}
      />,
    )

    expect(mocks.submitReview).not.toHaveBeenCalled()

    isOnline = true
    act(() => {
      eventTarget.dispatchEvent(new Event('online'))
    })

    await waitFor(() => {
      expect(mocks.markSynced).toHaveBeenCalledWith('idem_1')
    })
    expect(screen.getByText('已自动同步 1 条离线作答')).toBeInTheDocument()
    await waitFor(() =>
      expect(trackEvent).toHaveBeenCalledWith({
        name: 'offline_queue_synced',
        properties: {
          syncedCount: 1,
          failedCount: 0,
        },
      }),
    )
  })

  it('pauses repeated automatic sync attempts for the same expired token', async () => {
    const eventTarget = new EventTarget()
    const submitReview = vi
      .fn()
      .mockRejectedValue(
        new StudyApiError('UNAUTHORIZED', '登录状态已失效，请重新登录。'),
      )
    const { client, mocks, queue } = createComponentTestDoubles({
      readyReviews: [pendingReview],
      submitReview,
    })

    render(
      <OfflineReviewSyncStatus
        eventTarget={eventTarget}
        isOnline={() => true}
        queue={queue}
        studyApi={client}
      />,
    )

    await screen.findByText('登录状态已失效，离线作答已暂停同步，请重新登录。')

    act(() => {
      eventTarget.dispatchEvent(new Event('online'))
    })

    await waitFor(() => {
      expect(submitReview).toHaveBeenCalledTimes(1)
    })
    expect(mocks.markFailed).toHaveBeenCalledWith(
      'idem_1',
      '登录状态已失效，请重新登录。',
    )
  })
})

function createComponentTestDoubles(input: {
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
