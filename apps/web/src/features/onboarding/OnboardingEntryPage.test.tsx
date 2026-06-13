import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type {
  ActiveStudyPlanResponse,
  StudyPlan,
  StudyPlanResponse,
  VocabularyBook,
} from '@wordscodex/contracts'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../auth/auth-store'
import { OnboardingEntryPage } from './OnboardingEntryPage'
import type { StudyPlanClient } from './api'
import type { VocabularyClient } from '../vocabulary/api'

const fixedNow = '2026-06-13T00:00:00.000Z'

const book: VocabularyBook = {
  id: 'book_cet4',
  slug: 'cet4-core',
  name: '大学英语四级核心词汇',
  category: 'college',
  description: '覆盖四级高频核心词，适合大学阶段系统备考。',
  wordCount: 2600,
  version: 1,
  publishedAt: '2026-06-12T00:00:00.000Z',
  createdAt: '2026-06-12T00:00:00.000Z',
  updatedAt: '2026-06-12T00:00:00.000Z',
}

const plan: StudyPlan = {
  id: 'plan_123',
  userId: 'user_123',
  vocabularyBookId: 'book_cet4',
  learningGoal: 'college',
  dailyNewWordTarget: 50,
  dailyReviewLimit: 80,
  targetDate: '2026-08-03T00:00:00.000Z',
  reminderEnabled: true,
  status: 'active',
  startedAt: fixedNow,
  createdAt: fixedNow,
  updatedAt: fixedNow,
}

function createClients(input?: {
  activePlan?: StudyPlan | null
  createPlan?: StudyPlanClient['createPlan']
}) {
  const mocks = {
    getBook: vi.fn().mockResolvedValue({ book }),
    listBooks: vi.fn().mockResolvedValue({ books: [book] }),
    getActivePlan: vi.fn().mockResolvedValue({
      plan: input?.activePlan ?? null,
    } satisfies ActiveStudyPlanResponse),
    createPlan:
      input?.createPlan ??
      vi.fn().mockResolvedValue({
        plan,
      } satisfies StudyPlanResponse),
  }

  return {
    vocabularyApi: {
      getBook: mocks.getBook,
      listBooks: mocks.listBooks,
    } satisfies VocabularyClient,
    studyPlanApi: {
      getActivePlan: mocks.getActivePlan,
      createPlan: mocks.createPlan,
    } satisfies StudyPlanClient,
    mocks,
  }
}

function renderOnboarding(
  initialPath = '/onboarding?book=cet4-core',
  clients = createClients(),
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
        path: '/onboarding',
        element: (
          <OnboardingEntryPage
            studyPlanApi={clients.studyPlanApi}
            vocabularyApi={clients.vocabularyApi}
          />
        ),
      },
      {
        path: '/home',
        element: <h1>今日任务</h1>,
      },
      {
        path: '/books',
        element: <h1>选择你的第一本词库</h1>,
      },
    ],
    {
      initialEntries: [initialPath],
    },
  )

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )

  return { ...clients, router }
}

describe('OnboardingEntryPage', () => {
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
        createdAt: fixedNow,
        updatedAt: fixedNow,
      },
      initialized: true,
    })
    vi.clearAllMocks()
  })

  it('loads the selected vocabulary book and creates a study plan', async () => {
    const { mocks, router } = renderOnboarding()

    expect(
      await screen.findByRole('heading', { name: '生成你的学习计划' }),
    ).toBeInTheDocument()
    expect(screen.getByText('大学英语四级核心词汇')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('每日新词量'), {
      target: { value: '50' },
    })
    fireEvent.click(screen.getByLabelText('开启学习提醒'))
    fireEvent.click(screen.getByRole('button', { name: '生成学习计划' }))

    await waitFor(() =>
      expect(mocks.createPlan).toHaveBeenCalledWith(
        {
          vocabularyBookId: 'cet4-core',
          learningGoal: 'college',
          dailyNewWordTarget: 50,
          dailyReviewLimit: 80,
          targetDate: null,
          reminderEnabled: true,
        },
        'access-token',
      ),
    )
    await screen.findByRole('heading', { name: '今日任务' })
    expect(router.state.location.pathname).toBe('/home')
  })

  it('points learners back to vocabulary selection when no book is selected', async () => {
    renderOnboarding('/onboarding')

    expect(await screen.findByText('还没有选择词库')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '选择词库' })).toHaveAttribute(
      'href',
      '/books',
    )
  })

  it('shows an existing active plan instead of creating another one', async () => {
    renderOnboarding(
      '/onboarding?book=cet4-core',
      createClients({ activePlan: plan }),
    )

    expect(await screen.findByText('已有进行中的学习计划')).toBeInTheDocument()
    expect(
      screen.getByText('每日 50 个新词，系统会继续按这个计划安排学习和复习。'),
    ).toBeInTheDocument()
  })

  it('shows API errors and enables retry', async () => {
    const createPlan = vi
      .fn()
      .mockRejectedValueOnce(new Error('已经有进行中的学习计划。'))
    renderOnboarding(
      '/onboarding?book=cet4-core',
      createClients({ createPlan }),
    )

    await screen.findByText('大学英语四级核心词汇')
    fireEvent.click(screen.getByRole('button', { name: '生成学习计划' }))

    expect(
      await screen.findByRole('alert', {
        name: '已经有进行中的学习计划。',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '生成学习计划' })).toBeEnabled()
  })
})
