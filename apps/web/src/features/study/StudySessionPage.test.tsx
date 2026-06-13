import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { StudySessionResponse, User } from '@wordscodex/contracts'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../auth/auth-store'
import { StudySessionPage } from './StudySessionPage'
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
}

function createStudyClient(overrides: Partial<StudyClient> = {}) {
  const mocks = {
    getToday: vi.fn(),
    createSession: vi.fn(),
    getSession: vi.fn().mockResolvedValue(sessionResponse),
  }

  return {
    client: {
      ...mocks,
      ...overrides,
    } satisfies StudyClient,
    mocks,
  }
}

function renderStudySession(setup = createStudyClient()) {
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
        element: <StudySessionPage studyApi={setup.client} />,
      },
      {
        path: '/home',
        element: <h1>今日任务</h1>,
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
    expect(screen.getByText('ability')).toBeInTheDocument()
    expect(screen.getByText('/əˈbɪləti/')).toBeInTheDocument()
    expect(screen.getByText('能力；才能')).toBeInTheDocument()
    expect(
      screen.getByText('Reading improves your ability to learn.'),
    ).toBeInTheDocument()
    expect(mocks.getSession).toHaveBeenCalledWith('session_123', 'access-token')
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
