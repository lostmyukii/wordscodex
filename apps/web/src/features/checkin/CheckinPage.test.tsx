import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type {
  CheckinListResponse,
  CreateCheckinResponse,
  User,
} from '@wordscodex/contracts'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../auth/auth-store'
import { CheckinPage } from './CheckinPage'
import type { CheckinClient } from './api'

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

const listResponse: CheckinListResponse = {
  summary: {
    todayKey: '2026-06-13',
    checkedInToday: false,
    currentStreak: 0,
    recentDays: [
      { dateKey: '2026-06-07', checkedIn: false },
      { dateKey: '2026-06-08', checkedIn: false },
      { dateKey: '2026-06-09', checkedIn: false },
      { dateKey: '2026-06-10', checkedIn: false },
      { dateKey: '2026-06-11', checkedIn: false },
      { dateKey: '2026-06-12', checkedIn: false },
      { dateKey: '2026-06-13', checkedIn: false },
    ],
  },
  items: [],
}

const createResponse: CreateCheckinResponse = {
  checkin: {
    id: 'checkin_123',
    dateKey: '2026-06-13',
    checkedInAt: fixedIso,
    completedSessions: 1,
  },
  summary: {
    ...listResponse.summary,
    checkedInToday: true,
    currentStreak: 1,
    recentDays: listResponse.summary.recentDays.map((day) =>
      day.dateKey === '2026-06-13' ? { ...day, checkedIn: true } : day,
    ),
  },
  alreadyCheckedIn: false,
}

function createCheckinClient(overrides: Partial<CheckinClient> = {}) {
  const mocks = {
    listCheckins: vi.fn().mockResolvedValue(listResponse),
    createCheckin: vi.fn().mockResolvedValue(createResponse),
  }

  return {
    client: {
      ...mocks,
      ...overrides,
    } satisfies CheckinClient,
    mocks,
  }
}

function renderCheckin(setup = createCheckinClient()) {
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
        path: '/checkin',
        element: <CheckinPage checkinApi={setup.client} />,
      },
      {
        path: '/dashboard',
        element: <h1>学习看板</h1>,
      },
      {
        path: '/home',
        element: <h1>今日任务</h1>,
      },
    ],
    {
      initialEntries: ['/checkin'],
    },
  )

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )

  return { ...setup, router }
}

describe('CheckinPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'access-token',
      user,
      initialized: true,
    })
    vi.clearAllMocks()
  })

  it('shows checkin summary and creates today checkin', async () => {
    const { mocks } = renderCheckin()

    expect(
      await screen.findByRole('heading', { name: '今日打卡' }),
    ).toBeInTheDocument()
    expect(screen.getByText('已连续打卡 0 天')).toBeInTheDocument()
    expect(screen.getByText('今天还没有打卡')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '今日打卡' }))

    await waitFor(() =>
      expect(mocks.createCheckin).toHaveBeenCalledWith('access-token'),
    )
    expect(await screen.findByText('已连续打卡 1 天')).toBeInTheDocument()
    expect(screen.getByText('今日已打卡')).toBeInTheDocument()
  })

  it('shows a retryable error state', async () => {
    const listCheckins = vi
      .fn()
      .mockRejectedValueOnce(new Error('打卡记录加载失败。'))
      .mockResolvedValueOnce(listResponse)
    renderCheckin(
      createCheckinClient({
        listCheckins,
      }),
    )

    expect(await screen.findByText('打卡记录加载失败。')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重新加载打卡记录' }))

    await screen.findByText('今天还没有打卡')
    expect(listCheckins).toHaveBeenCalledTimes(2)
  })
})
