import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import type {
  StudySessionResponse,
  SubmitReviewResponse,
  User,
} from '@wordscodex/contracts'
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

function createStudyClient(overrides: Partial<StudyClient> = {}) {
  const mocks = {
    getToday: vi.fn(),
    createSession: vi.fn(),
    getSession: vi.fn().mockResolvedValue(sessionResponse),
    submitReview: vi.fn().mockResolvedValue(submitReviewResponse),
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
    expect(screen.getByText('/əˈbɪləti/')).toBeInTheDocument()
    expect(mocks.getSession).toHaveBeenCalledWith('session_123', 'access-token')
    expect(
      screen.getByRole('heading', { name: 'ability 的中文意思是？' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '不认识' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '认识' })).toBeInTheDocument()
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
