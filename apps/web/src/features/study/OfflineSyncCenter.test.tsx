import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type {
  SubmitReviewRequest,
  SubmitReviewResponse,
} from '@wordscodex/contracts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../auth/auth-store'
import type { StudyClient } from './api'
import { OfflineSyncCenter } from './OfflineSyncCenter'
import { offlineReviewQueueChangedEventName } from './offline-review-queue'
import type {
  OfflineReviewQueueClient,
  OfflineReviewQueueSummary,
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

describe('OfflineSyncCenter', () => {
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

  it('shows pending review sync progress and retries manually', async () => {
    const eventTarget = new EventTarget()
    const summary: OfflineReviewQueueSummary = {
      pendingCount: 1,
      readyCount: 1,
      nextRetryAt: null,
      lastError: '网络连接失败。',
    }
    const { client, mocks, queue } = createComponentTestDoubles({
      readyReviews: [pendingReview],
      summary,
    })

    render(
      <OfflineSyncCenter
        eventTarget={eventTarget}
        isOnline={() => true}
        queue={queue}
        studyApi={client}
      />,
    )

    expect(await screen.findByText('离线同步中心')).toBeInTheDocument()
    expect(screen.getByText('待同步 1 条作答')).toBeInTheDocument()
    expect(screen.getByText('可立即同步 1 条')).toBeInTheDocument()
    expect(screen.getByText('上次错误：网络连接失败。')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '立即同步' }))

    await waitFor(() => {
      expect(mocks.markSynced).toHaveBeenCalledWith('idem_1')
    })
    expect(screen.getByText('已同步 1 条离线作答')).toBeInTheDocument()
  })

  it('refreshes the summary when the browser comes back online', async () => {
    const eventTarget = new EventTarget()
    const { getSummary, queue } = createQueue({
      readyReviews: [],
      summary: {
        pendingCount: 0,
        readyCount: 0,
        nextRetryAt: null,
        lastError: null,
      },
    })
    getSummary
      .mockResolvedValueOnce({
        pendingCount: 0,
        readyCount: 0,
        nextRetryAt: null,
        lastError: null,
      })
      .mockResolvedValueOnce({
        pendingCount: 2,
        readyCount: 1,
        nextRetryAt: '2026-06-13T08:04:00.000Z',
        lastError: null,
      })

    render(
      <OfflineSyncCenter
        eventTarget={eventTarget}
        isOnline={() => true}
        queue={queue}
        studyApi={createStudyClient()}
      />,
    )

    expect(screen.queryByText('离线同步中心')).toBeNull()

    act(() => {
      eventTarget.dispatchEvent(new Event('online'))
    })

    expect(await screen.findByText('待同步 2 条作答')).toBeInTheDocument()
    expect(screen.getByText('可立即同步 1 条')).toBeInTheDocument()
  })

  it('refreshes the summary when a review is queued locally', async () => {
    const eventTarget = new EventTarget()
    const { getSummary, queue } = createQueue({
      readyReviews: [],
      summary: {
        pendingCount: 0,
        readyCount: 0,
        nextRetryAt: null,
        lastError: null,
      },
    })
    getSummary
      .mockResolvedValueOnce({
        pendingCount: 0,
        readyCount: 0,
        nextRetryAt: null,
        lastError: null,
      })
      .mockResolvedValueOnce({
        pendingCount: 1,
        readyCount: 1,
        nextRetryAt: null,
        lastError: '网络连接失败。',
      })

    render(
      <OfflineSyncCenter
        eventTarget={eventTarget}
        isOnline={() => true}
        queue={queue}
        studyApi={createStudyClient()}
      />,
    )

    act(() => {
      eventTarget.dispatchEvent(new Event(offlineReviewQueueChangedEventName))
    })

    expect(await screen.findByText('待同步 1 条作答')).toBeInTheDocument()
    expect(screen.getByText('上次错误：网络连接失败。')).toBeInTheDocument()
  })
})

function createComponentTestDoubles(input: {
  readyReviews: PendingReviewSubmission[]
  summary: OfflineReviewQueueSummary
}) {
  const markSynced = vi.fn().mockResolvedValue(undefined)
  const { queue } = createQueue({
    readyReviews: input.readyReviews,
    summary: input.summary,
    markSynced,
  })
  const client = createStudyClient()

  return {
    queue,
    client,
    mocks: {
      markSynced,
    },
  }
}

function createQueue(input: {
  readyReviews: PendingReviewSubmission[]
  summary: OfflineReviewQueueSummary
  markSynced?: OfflineReviewQueueClient['markSynced']
}) {
  const getSummary = vi.fn().mockResolvedValue(input.summary)
  const queue: OfflineReviewQueueClient = {
    enqueue: vi.fn(),
    listBySession: vi.fn().mockResolvedValue([]),
    listReady: vi.fn().mockResolvedValue(input.readyReviews),
    getSummary,
    markFailed: vi.fn().mockResolvedValue(undefined),
    markSynced: input.markSynced ?? vi.fn().mockResolvedValue(undefined),
  }

  return {
    queue,
    getSummary,
  }
}

function createStudyClient(): StudyClient {
  return {
    getToday: vi.fn(),
    createSession: vi.fn(),
    getSession: vi.fn(),
    submitReview: vi.fn().mockResolvedValue(submitReviewResponse),
    completeSession: vi.fn(),
    getSessionResult: vi.fn(),
  }
}
