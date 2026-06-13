import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type {
  StudySessionResponse,
  TodayResponse,
  User,
} from '@wordscodex/contracts'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../auth/auth-store'
import { HomePage } from './HomePage'
import type { StudyClient } from '../study/api'

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

const today: TodayResponse = {
  plan: {
    id: 'plan_123',
    userId: user.id,
    vocabularyBookId: 'book_cet4',
    learningGoal: 'college',
    dailyNewWordTarget: 50,
    dailyReviewLimit: 80,
    targetDate: null,
    reminderEnabled: true,
    status: 'active',
    startedAt: fixedIso,
    createdAt: fixedIso,
    updatedAt: fixedIso,
  },
  summary: {
    date: '2026-06-13',
    newWordsDue: 3,
    reviewsDue: 0,
    completedSessions: 0,
    canCheckIn: false,
  },
  tasks: [
    {
      type: 'new_words',
      title: '今日新词',
      count: 3,
      description: '学习计划安排的新词任务。',
    },
  ],
  nextSessionRecommendation: {
    mode: 'new_words',
    newWordLimit: 3,
    reviewLimit: 0,
  },
}

const sessionResponse: StudySessionResponse = {
  session: {
    id: 'session_123',
    userId: user.id,
    mode: 'new_words',
    status: 'active',
    startedAt: fixedIso,
    completedAt: null,
    items: [],
  },
}

function createStudyClient(overrides: Partial<StudyClient> = {}) {
  const mocks = {
    getToday: vi.fn().mockResolvedValue(today),
    createSession: vi.fn().mockResolvedValue(sessionResponse),
    getSession: vi.fn().mockResolvedValue(sessionResponse),
    submitReview: vi.fn(),
    completeSession: vi.fn(),
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

function renderHome(setup = createStudyClient()) {
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
        path: '/home',
        element: <HomePage studyApi={setup.client} />,
      },
      {
        path: '/books',
        element: <h1>选择你的第一本词库</h1>,
      },
      {
        path: '/study/session/:sessionId',
        element: <h1>学习会话</h1>,
      },
    ],
    {
      initialEntries: ['/home'],
    },
  )

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )

  return { ...setup, router }
}

describe('HomePage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'access-token',
      user,
      initialized: true,
    })
    vi.clearAllMocks()
  })

  it('shows today tasks and starts the recommended study session', async () => {
    const { mocks, router } = renderHome()

    expect(await screen.findByText('今日新词')).toBeInTheDocument()
    expect(screen.getByText('3 个')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '开始今日学习' }))

    await waitFor(() =>
      expect(mocks.createSession).toHaveBeenCalledWith(
        {
          mode: 'new_words',
          newWordLimit: 3,
          reviewLimit: 0,
        },
        'access-token',
      ),
    )
    await screen.findByRole('heading', { name: '学习会话' })
    expect(router.state.location.pathname).toBe('/study/session/session_123')
  })

  it('points learners to onboarding when there is no active plan', async () => {
    renderHome(
      createStudyClient({
        getToday: vi.fn().mockResolvedValue({
          ...today,
          plan: null,
          tasks: [],
          nextSessionRecommendation: null,
          summary: {
            ...today.summary,
            newWordsDue: 0,
          },
        } satisfies TodayResponse),
      }),
    )

    expect(await screen.findByText('还没有学习计划')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '选择词库' })).toHaveAttribute(
      'href',
      '/books',
    )
  })

  it('shows a retryable error state', async () => {
    const getToday = vi
      .fn()
      .mockRejectedValueOnce(new Error('今日任务加载失败。'))
      .mockResolvedValueOnce(today)
    renderHome(
      createStudyClient({
        getToday,
      }),
    )

    expect(await screen.findByText('今日任务加载失败。')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重新加载今日任务' }))

    await screen.findByText('今日新词')
    expect(getToday).toHaveBeenCalledTimes(2)
  })

  it('shows that a completed session unlocks check-in', async () => {
    renderHome(
      createStudyClient({
        getToday: vi.fn().mockResolvedValue({
          ...today,
          summary: {
            ...today.summary,
            completedSessions: 1,
            canCheckIn: true,
          },
        } satisfies TodayResponse),
      }),
    )

    expect(await screen.findByText('可打卡')).toBeInTheDocument()
    expect(screen.getByText('今天已完成 1 个学习会话')).toBeInTheDocument()
  })
})
