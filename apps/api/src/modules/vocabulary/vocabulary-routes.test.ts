import {
  errorResponseSchema,
  vocabularyBookDetailResponseSchema,
  vocabularyBookListResponseSchema,
  type VocabularyBook,
} from '@wordscodex/contracts'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../app.js'
import type { AuthService } from '../auth/auth-service.js'
import type { VocabularyRepository } from './vocabulary-routes.js'

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
    id: 'book_postgraduate',
    slug: 'postgraduate-core',
    name: '考研英语核心词汇',
    category: 'postgraduate',
    description: '围绕考研高频词、熟词僻义和真题语境组织。',
    wordCount: 3200,
    version: 1,
    publishedAt: fixedNow,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  },
]

class MemoryVocabularyRepository implements VocabularyRepository {
  listBooks(input: { q?: string }) {
    const query = input.q?.toLowerCase()
    if (!query) return Promise.resolve(books)

    return Promise.resolve(
      books.filter(
        (book) =>
          book.name.toLowerCase().includes(query) ||
          book.slug.toLowerCase().includes(query) ||
          book.description.toLowerCase().includes(query),
      ),
    )
  }

  findBook(bookId: string) {
    return Promise.resolve(
      books.find((book) => book.id === bookId || book.slug === bookId) ?? null,
    )
  }
}

describe('vocabulary routes', () => {
  let app: FastifyInstance

  beforeEach(() => {
    app = buildApp({
      authService: {} as AuthService,
      vocabularyRepository: new MemoryVocabularyRepository(),
    })
  })

  afterEach(async () => {
    await app.close()
  })

  it('returns published vocabulary books', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/vocabulary-books',
    })
    const body = vocabularyBookListResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(200)
    expect(body.books).toHaveLength(2)
    expect(body.books[0]).toMatchObject({
      slug: 'cet4-core',
      category: 'college',
    })
  })

  it('filters vocabulary books by query text', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/vocabulary-books?q=考研',
    })
    const body = vocabularyBookListResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(200)
    expect(body.books).toHaveLength(1)
    expect(body.books[0]?.slug).toBe('postgraduate-core')
  })

  it('returns a vocabulary book detail by slug', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/vocabulary-books/cet4-core',
    })
    const body = vocabularyBookDetailResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(200)
    expect(body.book).toMatchObject({
      name: '大学英语四级核心词汇',
      wordCount: 2600,
    })
  })

  it('returns the standard error when a book does not exist', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/vocabulary-books/missing',
    })
    const body = errorResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(404)
    expect(body.error).toMatchObject({
      code: 'NOT_FOUND',
      message: '词库不存在。',
    })
    expect(body.error.requestId).toBeTruthy()
  })
})
