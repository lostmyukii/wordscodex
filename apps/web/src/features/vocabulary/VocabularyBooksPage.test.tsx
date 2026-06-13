import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { VocabularyBook } from '@wordscodex/contracts'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { VocabularyBooksPage } from './VocabularyBooksPage'
import { VocabularyBookDetailPage } from './VocabularyBookDetailPage'
import type { VocabularyClient } from './api'

const fixedNow = '2026-06-12T00:00:00.000Z'

const books: VocabularyBook[] = [
  {
    id: 'book_cet4',
    slug: 'cet4-core',
    name: '大学英语四级核心词汇',
    category: 'college',
    description: '覆盖四级高频核心词，适合大学阶段系统备考。',
    wordCount: 2600,
    version: 1,
    publishedAt: fixedNow,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  },
  {
    id: 'book_workplace',
    slug: 'workplace-business',
    name: '职场商务英语高频词',
    category: 'workplace',
    description: '围绕会议、邮件和沟通场景组织的职场词库。',
    wordCount: 1800,
    version: 1,
    publishedAt: fixedNow,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  },
]

function createVocabularyClient(overrides: Partial<VocabularyClient> = {}) {
  const mocks = {
    listBooks: vi.fn().mockResolvedValue({
      books,
    }),
    getBook: vi.fn().mockResolvedValue({
      book: books[0],
    }),
  }

  return {
    client: {
      ...mocks,
      ...overrides,
    } satisfies VocabularyClient,
    mocks,
  }
}

function renderVocabulary(
  initialPath: string,
  setup = createVocabularyClient(),
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
        path: '/books',
        element: <VocabularyBooksPage vocabularyApi={setup.client} />,
      },
      {
        path: '/books/:bookId',
        element: <VocabularyBookDetailPage vocabularyApi={setup.client} />,
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

  return { ...setup, router }
}

describe('VocabularyBooksPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists vocabulary books and links to details', async () => {
    renderVocabulary('/books')

    expect(
      screen.getByRole('heading', { name: '选择你的第一本词库' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('大学英语四级核心词汇')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: '查看 大学英语四级核心词汇' }),
    ).toHaveAttribute('href', '/books/cet4-core')
    expect(screen.getByText('2600 词')).toBeInTheDocument()
  })

  it('sends trimmed search text to the API', async () => {
    const { mocks } = renderVocabulary('/books')

    fireEvent.change(screen.getByLabelText('搜索词库'), {
      target: { value: '  四级  ' },
    })

    await waitFor(() =>
      expect(mocks.listBooks).toHaveBeenLastCalledWith({
        q: '四级',
      }),
    )
  })

  it('shows an empty state when no book matches', async () => {
    renderVocabulary(
      '/books',
      createVocabularyClient({
        listBooks: vi.fn().mockResolvedValue({
          books: [],
        }),
      }),
    )

    expect(await screen.findByText('暂时没有匹配的词库')).toBeInTheDocument()
  })

  it('shows an error state and supports retry', async () => {
    const listBooks = vi
      .fn()
      .mockRejectedValueOnce(new Error('词库加载失败，请稍后重试。'))
      .mockResolvedValueOnce({
        books,
      })
    renderVocabulary(
      '/books',
      createVocabularyClient({
        listBooks,
      }),
    )

    expect(
      await screen.findByText('词库加载失败，请稍后重试。'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '重新加载词库' }))

    await screen.findByText('大学英语四级核心词汇')
    expect(listBooks).toHaveBeenCalledTimes(2)
  })
})

describe('VocabularyBookDetailPage', () => {
  it('shows book details and a plan creation CTA', async () => {
    renderVocabulary('/books/cet4-core')

    expect(await screen.findByText('大学英语四级核心词汇')).toBeInTheDocument()
    expect(screen.getByText('2600 个核心词')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '选择这个词库' })).toHaveAttribute(
      'href',
      '/onboarding?book=cet4-core',
    )
  })
})
