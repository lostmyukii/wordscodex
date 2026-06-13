import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type {
  MistakeListResponse,
  StudySessionResponse,
  User,
} from '@wordscodex/contracts'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../auth/auth-store'
import { MistakesPage } from './MistakesPage'
import type { MistakesClient } from './api'

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

const word = {
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
}

const mistakesResponse: MistakeListResponse = {
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
    total: 1,
    dueNow: 1,
  },
  items: [
    {
      word,
      masteryState: 'mistake',
      repetitions: 1,
      correctCount: 0,
      incorrectCount: 1,
      lastReviewedAt: fixedIso,
      nextReviewAt: '2026-06-13T00:10:00.000Z',
      lastErrorType: 'word_to_meaning',
      updatedAt: fixedIso,
    },
  ],
}

const mistakeSessionResponse: StudySessionResponse = {
  session: {
    id: 'session_mistake',
    userId: user.id,
    mode: 'mistake_drill',
    status: 'active',
    startedAt: fixedIso,
    completedAt: null,
    items: [
      {
        id: 'item_1',
        position: 1,
        questionType: 'word_to_meaning',
        word,
      },
    ],
  },
}

function createMistakesClient(overrides: Partial<MistakesClient> = {}) {
  const mocks = {
    listMistakes: vi.fn().mockResolvedValue(mistakesResponse),
    createMistakeDrillSession: vi
      .fn()
      .mockResolvedValue(mistakeSessionResponse),
  }

  return {
    client: {
      ...mocks,
      ...overrides,
    } satisfies MistakesClient,
    mocks,
  }
}

function renderMistakes(setup = createMistakesClient()) {
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
        path: '/mistakes',
        element: <MistakesPage mistakesApi={setup.client} />,
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
      initialEntries: ['/mistakes'],
    },
  )

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )

  return { ...setup, router }
}

describe('MistakesPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'access-token',
      user,
      initialized: true,
    })
    vi.clearAllMocks()
  })

  it('shows mistake words and starts a mistake drill session', async () => {
    const { mocks, router } = renderMistakes()

    expect(
      await screen.findByRole('heading', { name: '错词本' }),
    ).toBeInTheDocument()
    expect(screen.getByText('ability')).toBeInTheDocument()
    expect(screen.getByText('错词')).toBeInTheDocument()
    expect(screen.getByText(/1 个待强化/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '开始错词强化' }))

    await waitFor(() =>
      expect(mocks.createMistakeDrillSession).toHaveBeenCalledWith(
        {
          limit: 20,
        },
        'access-token',
      ),
    )
    await screen.findByRole('heading', { name: '学习会话' })
    expect(router.state.location.pathname).toBe(
      '/study/session/session_mistake',
    )
  })

  it('points learners to vocabulary selection when there is no active plan', async () => {
    renderMistakes(
      createMistakesClient({
        listMistakes: vi.fn().mockResolvedValue({
          ...mistakesResponse,
          plan: null,
          summary: {
            total: 0,
            dueNow: 0,
          },
          items: [],
        } satisfies MistakeListResponse),
      }),
    )

    expect(await screen.findByText('还没有学习计划')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '选择词库' })).toHaveAttribute(
      'href',
      '/books',
    )
  })

  it('shows an empty state when there are no mistake words', async () => {
    renderMistakes(
      createMistakesClient({
        listMistakes: vi.fn().mockResolvedValue({
          ...mistakesResponse,
          summary: {
            total: 0,
            dueNow: 0,
          },
          items: [],
        } satisfies MistakeListResponse),
      }),
    )

    expect(await screen.findByText('暂无错词')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '开始错词强化' })).toBeDisabled()
  })

  it('shows a retryable error state', async () => {
    const listMistakes = vi
      .fn()
      .mockRejectedValueOnce(new Error('错词加载失败。'))
      .mockResolvedValueOnce(mistakesResponse)
    renderMistakes(
      createMistakesClient({
        listMistakes,
      }),
    )

    expect(await screen.findByText('错词加载失败。')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重新加载错词' }))

    await screen.findByText('ability')
    expect(listMistakes).toHaveBeenCalledTimes(2)
  })
})
