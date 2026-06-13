import type {
  CompleteStudySessionResponse,
  SubmitReviewResponse,
} from '@wordscodex/contracts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { studyApi, type StudyApiError } from './api'

const word = {
  id: 'word_1',
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
}

const session = {
  id: 'session_123',
  userId: 'user_123',
  mode: 'new_words',
  status: 'completed',
  startedAt: '2026-06-13T00:00:00.000Z',
  completedAt: '2026-06-13T00:05:00.000Z',
  items: [
    {
      id: 'item_1',
      position: 1,
      questionType: 'word_to_meaning',
      word,
    },
  ],
} satisfies CompleteStudySessionResponse['session']

const completeResponse = {
  session,
  result: {
    session,
    summary: {
      totalItems: 1,
      answeredItems: 1,
      correctCount: 1,
      incorrectCount: 0,
      accuracyRate: 1,
      totalResponseMs: 1200,
      completedAt: '2026-06-13T00:05:00.000Z',
      canCheckIn: true,
    },
    items: [
      {
        word,
        questionType: 'word_to_meaning',
        rating: 'good',
        isCorrect: true,
        responseMs: 1200,
        answer: '认识',
        reviewedAt: '2026-06-13T00:01:00.000Z',
        masteryState: 'learning',
        nextReviewAt: '2026-06-15T00:01:00.000Z',
      },
    ],
  },
} satisfies CompleteStudySessionResponse

const submitReviewResponse = {
  progress: {
    masteryState: 'learning',
    repetitions: 1,
    consecutiveCorrect: 1,
    correctCount: 1,
    incorrectCount: 0,
    easeFactor: 2.5,
    intervalDays: 2,
    lastReviewedAt: '2026-06-13T00:01:00.000Z',
    nextReviewAt: '2026-06-15T00:01:00.000Z',
    averageResponseMs: 1200,
    lastErrorType: null,
  },
  alreadyProcessed: false,
} satisfies SubmitReviewResponse

describe('studyApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not send an empty JSON content-type when completing a session', async () => {
    const fetchRecorder = mockJsonResponse(completeResponse)
    vi.stubGlobal('fetch', fetchRecorder.fetchMock)

    await studyApi.completeSession('session_123', 'access-token')

    const init = fetchRecorder.getLastInit()
    const headers = new Headers(init?.headers)
    expect(init?.body).toBeUndefined()
    expect(headers.get('authorization')).toBe('Bearer access-token')
    expect(headers.has('content-type')).toBe(false)
  })

  it('keeps JSON content-type and idempotency key when submitting a review body', async () => {
    const fetchRecorder = mockJsonResponse(submitReviewResponse, 201)
    vi.stubGlobal('fetch', fetchRecorder.fetchMock)

    await studyApi.submitReview(
      'session_123',
      {
        wordId: 'word_1',
        questionType: 'word_to_meaning',
        rating: 'good',
        isCorrect: true,
        responseMs: 1200,
        answer: '认识',
        reviewedAt: '2026-06-13T00:01:00.000Z',
      },
      'idem_123',
      'access-token',
    )

    const init = fetchRecorder.getLastInit()
    const headers = new Headers(init?.headers)
    expect(headers.get('authorization')).toBe('Bearer access-token')
    expect(headers.get('content-type')).toBe('application/json')
    expect(headers.get('idempotency-key')).toBe('idem_123')
  })

  it('exposes the stable API error code on failed study requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error: {
                code: 'UNAUTHORIZED',
                message: '登录状态已失效，请重新登录。',
                requestId: 'req_123',
              },
            }),
            {
              status: 401,
              headers: {
                'content-type': 'application/json',
              },
            },
          ),
        ),
      ),
    )

    await expect(
      studyApi.getToday('expired-access-token'),
    ).rejects.toMatchObject({
      name: 'StudyApiError',
      code: 'UNAUTHORIZED',
      message: '登录状态已失效，请重新登录。',
    } satisfies Partial<StudyApiError>)
  })
})

function mockJsonResponse(body: unknown, status = 200) {
  let lastInit: RequestInit | undefined
  const fetchMock = vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
    lastInit = init

    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: {
          'content-type': 'application/json',
        },
      }),
    )
  })

  return {
    fetchMock,
    getLastInit() {
      if (!lastInit) throw new Error('fetch was not called')
      return lastInit
    },
  }
}
