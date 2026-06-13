import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import type { DashboardSummaryResponse, User } from '@wordscodex/contracts'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../auth/auth-store'
import { DashboardPage } from './DashboardPage'
import type { DashboardClient } from './api'

const fixedIso = '2026-06-13T08:00:00.000Z'

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

const summaryResponse: DashboardSummaryResponse = {
  plan: null,
  today: {
    dateKey: '2026-06-13',
    completedSessions: 1,
    canCheckIn: true,
    checkedInToday: true,
  },
  totals: {
    learnedWords: 12,
    masteredWords: 3,
    reviewLogs: 20,
    checkins: 1,
  },
  progress: {
    activeBookName: '大学英语四级核心词汇',
    totalWords: 2600,
    learnedWords: 12,
    masteredWords: 3,
    dueReviews: 2,
  },
  streak: {
    current: 1,
    recentDays: [
      { dateKey: '2026-06-07', checkedIn: false },
      { dateKey: '2026-06-08', checkedIn: false },
      { dateKey: '2026-06-09', checkedIn: false },
      { dateKey: '2026-06-10', checkedIn: false },
      { dateKey: '2026-06-11', checkedIn: false },
      { dateKey: '2026-06-12', checkedIn: false },
      { dateKey: '2026-06-13', checkedIn: true },
    ],
  },
  generatedAt: fixedIso,
}

function createDashboardClient(overrides: Partial<DashboardClient> = {}) {
  const mocks = {
    getSummary: vi.fn().mockResolvedValue(summaryResponse),
  }

  return {
    client: {
      ...mocks,
      ...overrides,
    } satisfies DashboardClient,
    mocks,
  }
}

function renderDashboard(setup = createDashboardClient()) {
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
        path: '/dashboard',
        element: <DashboardPage dashboardApi={setup.client} />,
      },
      {
        path: '/checkin',
        element: <h1>今日打卡</h1>,
      },
      {
        path: '/home',
        element: <h1>今日任务</h1>,
      },
    ],
    {
      initialEntries: ['/dashboard'],
    },
  )

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )

  return { ...setup, router }
}

describe('DashboardPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'access-token',
      user,
      initialized: true,
    })
    vi.clearAllMocks()
  })

  it('shows learning summary and recent checkin days', async () => {
    renderDashboard()

    expect(
      await screen.findByRole('heading', { name: '学习看板' }),
    ).toBeInTheDocument()
    expect(screen.getByText('大学英语四级核心词汇')).toBeInTheDocument()
    expect(screen.getByText('今日会话')).toBeInTheDocument()
    expect(screen.getByText('已学习')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('已掌握')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('连续打卡 1 天')).toBeInTheDocument()
    expect(screen.getByLabelText('2026-06-13 已打卡')).toBeInTheDocument()
  })

  it('shows a retryable error state', async () => {
    const getSummary = vi
      .fn()
      .mockRejectedValueOnce(new Error('看板加载失败。'))
      .mockResolvedValueOnce(summaryResponse)
    renderDashboard(
      createDashboardClient({
        getSummary,
      }),
    )

    expect(await screen.findByText('看板加载失败。')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重新加载看板' }))

    await screen.findByText('大学英语四级核心词汇')
    expect(getSummary).toHaveBeenCalledTimes(2)
  })
})
