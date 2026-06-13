import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type {
  CompleteStudySessionResponse,
  StudySessionResponse,
  SubmitReviewResponse,
  User,
} from '@wordscodex/contracts'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../auth/auth-store'
import { StudySessionPage } from './StudySessionPage'
import type { TrackAnalyticsEvent } from '../analytics/track-event'
import type { StudyClient } from './api'
import { offlineReviewSyncCompletedEventName } from './offline-review-sync'
import type { StudySessionCacheClient } from './offline-session-cache'
import type {
  OfflineReviewQueueClient,
  PendingReviewSubmission,
} from './offline-review-queue'

const fixedIso = '2026-06-13T00:00:00.000Z'

type EnqueueReviewInput = Parameters<OfflineReviewQueueClient['enqueue']>[0]

const user: User = {
  id: 'user_123',
  email: null,
  displayName: '学习者',
  role: 'learner',
  accountType: 'guest',
  timezone: 'Asia/Shanghai',
  createdAt: fixedIso,
  updatedAt: fixedIso,
}

const sessionResponse: StudySessionResponse = {
  session: {
    id: 'session_123',
    userId: user.id,
    mode: 'new_words',
    status: 'active',
    startedAt: fixedIso,
    completedAt: null,
    items: [
      {
        id: 'item_1',
        position: 1,
        questionType: 'word_to_meaning',
        word: {
          id: 'word_ability',
          lemma: 'ability',
          phoneticUk: '/əˈbɪləti/',
          phoneticUs: '/əˈbɪləti/',
          audioUkUrl: null,
          audioUsUrl: null,
          imageUrl: null,
          meanings: [
            {
              partOfSpeech: 'n.',
              definitionZh: '能力；才能',
              definitionEn: 'the power or skill to do something',
            },
          ],
          examples: [
            {
              sentence: 'Reading improves your ability to learn.',
              translationZh: '阅读会提升你的学习能力。',
              source: 'seed',
            },
          ],
        },
      },
    ],
  },
  reviews: [],
}

const twoItemSessionResponse: StudySessionResponse = {
  session: {
    ...sessionResponse.session,
    items: [
      sessionResponse.session.items[0]!,
      {
        id: 'item_2',
        position: 2,
        questionType: 'word_to_meaning',
        word: {
          ...sessionResponse.session.items[0]!.word,
          id: 'word_absorb',
          lemma: 'absorb',
          meanings: [
            {
              partOfSpeech: 'v.',
              definitionZh: '吸收；理解',
              definitionEn: 'to take in or understand information',
            },
          ],
          examples: [],
        },
      },
    ],
  },
  reviews: [],
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
    nextReviewAt: '2026-06-15T00:00:00.000Z',
    averageResponseMs: 4200,
    lastErrorType: null,
  },
  alreadyProcessed: false,
}

const completeSessionResponse: CompleteStudySessionResponse = {
  session: {
    ...sessionResponse.session,
    status: 'completed',
    completedAt: '2026-06-13T00:05:00.000Z',
  },
  result: {
    session: {
      ...sessionResponse.session,
      status: 'completed',
      completedAt: '2026-06-13T00:05:00.000Z',
    },
    summary: {
      totalItems: 1,
      answeredItems: 1,
      correctCount: 1,
      incorrectCount: 0,
      accuracyRate: 1,
      totalResponseMs: 4200,
      completedAt: '2026-06-13T00:05:00.000Z',
      canCheckIn: true,
    },
    items: [
      {
        word: sessionResponse.session.items[0]!.word,
        questionType: 'word_to_meaning',
        rating: 'good',
        isCorrect: true,
        responseMs: 4200,
        answer: '认识',
        reviewedAt: fixedIso,
        masteryState: 'learning',
        nextReviewAt: '2026-06-15T00:00:00.000Z',
      },
    ],
  },
}

function createStudyClient(overrides: Partial<StudyClient> = {}) {
  const mocks = {
    getToday: vi.fn(),
    createSession: vi.fn(),
    getSession: vi.fn().mockResolvedValue(sessionResponse),
    submitReview: vi.fn().mockResolvedValue(submitReviewResponse),
    completeSession: vi.fn().mockResolvedValue(completeSessionResponse),
    getSessionResult: vi.fn(),
  }

  return {
    client: {
      ...mocks,
      ...overrides,
    } satisfies StudyClient,
    mocks,
  }
}

function createEmptyReviewQueue(): OfflineReviewQueueClient {
  return {
    enqueue: vi
      .fn()
      .mockImplementation(
        (input: EnqueueReviewInput): Promise<PendingReviewSubmission> =>
          Promise.resolve(toPendingReviewSubmission(input)),
      ),
    listBySession: vi.fn().mockResolvedValue([]),
    listReady: vi.fn().mockResolvedValue([]),
    getSummary: vi.fn().mockResolvedValue(emptyReviewQueueSummary),
    markFailed: vi.fn().mockResolvedValue(undefined),
    markSynced: vi.fn().mockResolvedValue(undefined),
  }
}

const emptyReviewQueueSummary = {
  pendingCount: 0,
  readyCount: 0,
  nextRetryAt: null,
  lastError: null,
}

function toPendingReviewSubmission(
  input: EnqueueReviewInput,
): PendingReviewSubmission {
  return {
    ...input,
    wordId: input.review.wordId,
    createdAt: input.createdAt ?? fixedIso,
    retryCount: 0,
    lastAttemptAt: null,
  }
}

function renderStudySession(
  setup = createStudyClient(),
  options: {
    sessionCache?: StudySessionCacheClient
    reviewQueue?: OfflineReviewQueueClient
    trackEvent?: TrackAnalyticsEvent
  } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  const router = createMemoryRouter(
    [
      {
        path: '/study/session/:sessionId',
        element: (
          <StudySessionPage
            studyApi={setup.client}
            reviewQueue={options.reviewQueue ?? createEmptyReviewQueue()}
            {...(options.trackEvent ? { trackEvent: options.trackEvent } : {})}
            {...(options.sessionCache
              ? { sessionCache: options.sessionCache }
              : {})}
          />
        ),
      },
      {
        path: '/home',
        element: <h1>今日任务</h1>,
      },
      {
        path: '/study/result/:sessionId',
        element: <h1>学习结果</h1>,
      },
    ],
    {
      initialEntries: ['/study/session/session_123'],
    },
  )

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )

  return { ...setup, router }
}

describe('StudySessionPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'access-token',
      user,
      initialized: true,
    })
    vi.clearAllMocks()
  })

  it('loads a study session and shows the first word card', async () => {
    const { mocks } = renderStudySession()

    expect(
      await screen.findByRole('heading', { name: '学习会话' }),
    ).toBeInTheDocument()
    expect(screen.getByText('/əˈbɪləti/')).toBeInTheDocument()
    expect(mocks.getSession).toHaveBeenCalledWith('session_123', 'access-token')
    expect(
      screen.getByRole('heading', { name: 'ability 的中文意思是？' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '不认识' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '认识' })).toBeInTheDocument()
  })

  it('caches the server study session for offline recovery', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const sessionCache: StudySessionCacheClient = {
      save,
      load: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
      clearExpired: vi.fn().mockResolvedValue(undefined),
    }

    renderStudySession(createStudyClient(), { sessionCache })

    await screen.findByRole('heading', { name: '学习会话' })
    await waitFor(() => expect(save).toHaveBeenCalledWith(sessionResponse))
  })

  it('uses a cached session when the server request fails', async () => {
    const load = vi.fn().mockResolvedValue(sessionResponse)
    const sessionCache: StudySessionCacheClient = {
      save: vi.fn().mockResolvedValue(undefined),
      load,
      delete: vi.fn().mockResolvedValue(undefined),
      clearExpired: vi.fn().mockResolvedValue(undefined),
    }

    renderStudySession(
      createStudyClient({
        getSession: vi.fn().mockRejectedValue(new Error('网络连接失败。')),
      }),
      { sessionCache },
    )

    expect(
      await screen.findByText('已从本地缓存恢复学习会话'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'ability 的中文意思是？' }),
    ).toBeInTheDocument()
    expect(load).toHaveBeenCalledWith('session_123')
  })

  it('labels review sessions as due review tasks', async () => {
    renderStudySession(
      createStudyClient({
        getSession: vi.fn().mockResolvedValue({
          session: {
            ...sessionResponse.session,
            mode: 'review',
          },
          reviews: [],
        } satisfies StudySessionResponse),
      }),
    )

    expect(await screen.findByText(/到期复习 · 共 1 题/)).toBeInTheDocument()
  })

  it('submits an active recall answer with an idempotency key', async () => {
    const { mocks } = renderStudySession()

    fireEvent.click(await screen.findByRole('button', { name: '认识' }))

    expect(await screen.findByText('作答已记录')).toBeInTheDocument()
    expect(screen.getByText('下次复习：2026-06-15')).toBeInTheDocument()
    expect(screen.getByText('能力；才能')).toBeInTheDocument()
    expect(
      screen.getByText('Reading improves your ability to learn.'),
    ).toBeInTheDocument()
    expect(mocks.submitReview).toHaveBeenCalledWith(
      'session_123',
      expect.objectContaining({
        wordId: 'word_ability',
        questionType: 'word_to_meaning',
        rating: 'good',
        isCorrect: true,
        answer: '认识',
      }),
      expect.stringMatching(/^review_session_123_word_ability_/),
      'access-token',
    )
  })

  it('queues a failed review submission and marks the answer as pending sync', async () => {
    let enqueueCallCount = 0
    const trackEvent = vi.fn<TrackAnalyticsEvent>().mockResolvedValue(undefined)
    const queuedInputRef: { current: EnqueueReviewInput | null } = {
      current: null,
    }
    const enqueue: OfflineReviewQueueClient['enqueue'] = (input) => {
      enqueueCallCount += 1
      queuedInputRef.current = input
      return Promise.resolve(toPendingReviewSubmission(input))
    }
    const reviewQueue: OfflineReviewQueueClient = {
      enqueue,
      listBySession: vi.fn().mockResolvedValue([]),
      listReady: vi.fn().mockResolvedValue([]),
      getSummary: vi.fn().mockResolvedValue(emptyReviewQueueSummary),
      markFailed: vi.fn().mockResolvedValue(undefined),
      markSynced: vi.fn().mockResolvedValue(undefined),
    }

    renderStudySession(
      createStudyClient({
        submitReview: vi.fn().mockRejectedValue(new Error('网络连接失败。')),
      }),
      { reviewQueue, trackEvent },
    )

    fireEvent.click(await screen.findByRole('button', { name: '认识' }))

    expect(await screen.findByText('作答待同步')).toBeInTheDocument()
    expect(screen.getByText(/还有 1 条作答待同步/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '完成会话' })).toBeNull()
    expect(enqueueCallCount).toBe(1)
    const queuedInput = queuedInputRef.current
    expect(queuedInput).toBeDefined()
    if (!queuedInput) throw new Error('Expected a queued review input')
    expect(queuedInput.sessionId).toBe('session_123')
    expect(queuedInput.idempotencyKey).toMatch(
      /^review_session_123_word_ability_/,
    )
    expect(queuedInput.review).toMatchObject({
      wordId: 'word_ability',
      rating: 'good',
      answer: '认识',
    })
    expect(queuedInput.lastError).toBe('网络连接失败。')
    await waitFor(() =>
      expect(trackEvent).toHaveBeenCalledWith({
        name: 'offline_queue_created',
        properties: {
          pendingCount: 1,
          retryCount: 0,
          sessionMode: 'new_words',
        },
      }),
    )
    const trackedEvents = trackEvent.mock.calls.map(([event]) => event)
    expect(
      trackedEvents.some((event) =>
        Object.prototype.hasOwnProperty.call(event.properties ?? {}, 'answer'),
      ),
    ).toBe(false)
    expect(
      trackedEvents.some((event) =>
        Object.prototype.hasOwnProperty.call(
          event.properties ?? {},
          'answerText',
        ),
      ),
    ).toBe(false)
  })

  it('syncs pending reviews with the original idempotency key before completion', async () => {
    const pendingReview: PendingReviewSubmission = {
      idempotencyKey: 'review_session_123_word_ability_pending',
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
      lastError: '网络连接失败。',
      lastAttemptAt: null,
    }
    const submitReview = vi
      .fn()
      .mockRejectedValueOnce(new Error('网络连接失败。'))
      .mockResolvedValueOnce(submitReviewResponse)
    let pendingReviews: PendingReviewSubmission[] = []
    const enqueue = vi.fn(() => {
      pendingReviews = [pendingReview]
      return Promise.resolve(pendingReview)
    })
    const listBySession = vi.fn(() => Promise.resolve(pendingReviews))
    const markFailed = vi.fn(() => Promise.resolve())
    const markSynced = vi.fn(() => {
      pendingReviews = []
      return Promise.resolve()
    })
    const reviewQueue: OfflineReviewQueueClient = {
      enqueue,
      listBySession,
      listReady: vi.fn(() => Promise.resolve(pendingReviews)),
      getSummary: vi.fn().mockResolvedValue(emptyReviewQueueSummary),
      markFailed,
      markSynced,
    }

    renderStudySession(
      createStudyClient({
        submitReview,
      }),
      { reviewQueue },
    )

    fireEvent.click(await screen.findByRole('button', { name: '认识' }))
    expect(await screen.findByText('作答待同步')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '同步待提交作答' }))

    expect(await screen.findByText('作答已记录')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '完成会话' })).toBeInTheDocument()
    expect(submitReview).toHaveBeenLastCalledWith(
      'session_123',
      pendingReview.review,
      'review_session_123_word_ability_pending',
      'access-token',
    )
    expect(markSynced).toHaveBeenCalledWith(
      'review_session_123_word_ability_pending',
    )
  })

  it('refreshes stale pending review state after background sync completes', async () => {
    const pendingReview: PendingReviewSubmission = {
      idempotencyKey: 'review_session_123_word_ability_pending',
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
      lastError: '网络连接失败。',
      lastAttemptAt: null,
    }
    const restoredSession = {
      ...sessionResponse,
      reviews: [
        {
          wordId: 'word_ability',
          questionType: 'word_to_meaning',
          rating: 'good',
          isCorrect: true,
          responseMs: 4200,
          answer: '认识',
          reviewedAt: fixedIso,
          progress: submitReviewResponse.progress,
        },
      ],
    } satisfies StudySessionResponse
    const getSession = vi
      .fn()
      .mockResolvedValueOnce(sessionResponse)
      .mockResolvedValueOnce(restoredSession)
    let pendingReviews: PendingReviewSubmission[] = [pendingReview]
    const reviewQueue: OfflineReviewQueueClient = {
      enqueue: vi.fn(),
      listBySession: vi.fn(() => Promise.resolve(pendingReviews)),
      listReady: vi.fn(() => Promise.resolve(pendingReviews)),
      getSummary: vi.fn().mockResolvedValue(emptyReviewQueueSummary),
      markFailed: vi.fn().mockResolvedValue(undefined),
      markSynced: vi.fn().mockResolvedValue(undefined),
    }

    renderStudySession(
      createStudyClient({
        getSession,
      }),
      { reviewQueue },
    )

    expect(await screen.findByText('作答待同步')).toBeInTheDocument()
    expect(screen.getByText(/还有 1 条作答待同步/)).toBeInTheDocument()

    pendingReviews = []
    fireEvent(
      window,
      new CustomEvent(offlineReviewSyncCompletedEventName, {
        detail: {
          syncedCount: 1,
        },
      }),
    )

    expect(await screen.findByText('作答已记录')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '完成会话' })).toBeInTheDocument()
    await waitFor(() => expect(getSession).toHaveBeenCalledTimes(2))
  })

  it('completes the answered session and navigates to the result page', async () => {
    const { mocks, router } = renderStudySession()

    fireEvent.click(await screen.findByRole('button', { name: '认识' }))
    fireEvent.click(await screen.findByRole('button', { name: '完成会话' }))

    expect(
      await screen.findByRole('heading', { name: '学习结果' }),
    ).toBeInTheDocument()
    expect(mocks.completeSession).toHaveBeenCalledWith(
      'session_123',
      'access-token',
    )
    expect(router.state.location.pathname).toBe('/study/result/session_123')
  })

  it('moves through every session item before allowing completion', async () => {
    const { mocks } = renderStudySession(
      createStudyClient({
        getSession: vi.fn().mockResolvedValue(twoItemSessionResponse),
      }),
    )

    fireEvent.click(await screen.findByRole('button', { name: '认识' }))
    fireEvent.click(await screen.findByRole('button', { name: '下一题' }))

    expect(
      await screen.findByRole('heading', { name: 'absorb 的中文意思是？' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '完成会话' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '认识' }))

    expect(
      await screen.findByRole('button', { name: '完成会话' }),
    ).toBeInTheDocument()
    expect(mocks.submitReview).toHaveBeenCalledTimes(2)
  })

  it('restores answered items from the server and continues the session', async () => {
    const restoredSession = {
      ...twoItemSessionResponse,
      reviews: [
        {
          wordId: 'word_ability',
          questionType: 'word_to_meaning',
          rating: 'good',
          isCorrect: true,
          responseMs: 4200,
          answer: '认识',
          reviewedAt: fixedIso,
          progress: submitReviewResponse.progress,
        },
      ],
    } satisfies StudySessionResponse
    const { mocks, router } = renderStudySession(
      createStudyClient({
        getSession: vi.fn().mockResolvedValue(restoredSession),
      }),
    )

    expect(await screen.findByText(/已答 1 题/)).toBeInTheDocument()
    expect(await screen.findByText('作答已记录')).toBeInTheDocument()
    expect(
      screen.getByText('已从服务端恢复作答记录，可继续完成会话。'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '认识' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: '下一题' }))
    expect(
      await screen.findByRole('heading', { name: 'absorb 的中文意思是？' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '认识' }))
    fireEvent.click(await screen.findByRole('button', { name: '完成会话' }))

    expect(mocks.submitReview).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(mocks.completeSession).toHaveBeenCalledWith(
        'session_123',
        'access-token',
      ),
    )
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/study/result/session_123'),
    )
  })

  it('shows a recovery link when the session cannot be loaded', async () => {
    renderStudySession(
      createStudyClient({
        getSession: vi.fn().mockRejectedValue(new Error('学习会话不存在。')),
      }),
    )

    expect(await screen.findByText('学习会话不存在。')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '返回今日任务' })).toHaveAttribute(
      'href',
      '/home',
    )
  })
})
