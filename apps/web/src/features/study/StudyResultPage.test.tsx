import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { StudySessionResultResponse, User } from '@wordscodex/contracts'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../auth/auth-store'
import { StudyResultPage } from './StudyResultPage'
import type { StudyClient } from './api'

const fixedIso = '2026-06-13T00:00:00.000Z'

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

const resultResponse: StudySessionResultResponse = {
  result: {
    session: {
      id: 'session_123',
      userId: user.id,
      mode: 'new_words',
      status: 'completed',
      startedAt: fixedIso,
      completedAt: '2026-06-13T00:05:00.000Z',
      items: [],
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
          examples: [],
        },
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
    getSession: vi.fn(),
    submitReview: vi.fn(),
    completeSession: vi.fn(),
    getSessionResult: vi.fn().mockResolvedValue(resultResponse),
  }

  return {
    client: {
      ...mocks,
      ...overrides,
    } satisfies StudyClient,
    mocks,
  }
}

function renderResult(setup = createStudyClient()) {
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
        path: '/study/result/:sessionId',
        element: <StudyResultPage studyApi={setup.client} />,
      },
      {
        path: '/home',
        element: <h1>今日任务</h1>,
      },
    ],
    {
      initialEntries: ['/study/result/session_123'],
    },
  )

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )

  return { ...setup, router }
}

describe('StudyResultPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'access-token',
      user,
      initialized: true,
    })
    vi.clearAllMocks()
  })

  it('shows the completed session result from the server', async () => {
    const { mocks } = renderResult()

    expect(
      await screen.findByRole('heading', { name: '学习结果' }),
    ).toBeInTheDocument()
    expect(screen.getByText('正确率 100%')).toBeInTheDocument()
    expect(screen.getByText('已完成 1 / 1 题')).toBeInTheDocument()
    expect(screen.getByText('今日已满足打卡条件')).toBeInTheDocument()
    expect(screen.getByText('ability')).toBeInTheDocument()
    expect(screen.getByText('下次复习：2026-06-15')).toBeInTheDocument()
    expect(mocks.getSessionResult).toHaveBeenCalledWith(
      'session_123',
      'access-token',
    )
  })

  it('shows a recovery link when the result cannot be loaded', async () => {
    renderResult(
      createStudyClient({
        getSessionResult: vi
          .fn()
          .mockRejectedValue(new Error('学习结果不存在。')),
      }),
    )

    expect(await screen.findByText('学习结果不存在。')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '返回今日任务' })).toHaveAttribute(
      'href',
      '/home',
    )
  })
})
