import { describe, expect, it } from 'vitest'
import {
  errorResponseSchema,
  vocabularyBookDetailResponseSchema,
  vocabularyBookListResponseSchema,
  vocabularyBookSearchQuerySchema,
} from './index.js'

const book = {
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

describe('vocabulary contracts', () => {
  it('accepts the public vocabulary book list and detail payloads', () => {
    expect(
      vocabularyBookListResponseSchema.parse({
        books: [book],
      }),
    ).toEqual({
      books: [book],
    })

    expect(
      vocabularyBookDetailResponseSchema.parse({
        book,
      }),
    ).toEqual({
      book,
    })
  })

  it('normalizes optional search query text', () => {
    expect(
      vocabularyBookSearchQuerySchema.parse({
        q: '  四级  ',
      }),
    ).toEqual({
      q: '四级',
    })
  })

  it('rejects unknown categories and invalid counters', () => {
    expect(() =>
      vocabularyBookListResponseSchema.parse({
        books: [
          {
            ...book,
            category: 'social',
          },
        ],
      }),
    ).toThrow()

    expect(() =>
      vocabularyBookDetailResponseSchema.parse({
        book: {
          ...book,
          wordCount: -1,
        },
      }),
    ).toThrow()
  })

  it('allows generic not found errors without weakening stable codes', () => {
    expect(
      errorResponseSchema.parse({
        error: {
          code: 'NOT_FOUND',
          message: '词库不存在。',
          requestId: 'req_123',
        },
      }),
    ).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: '词库不存在。',
        requestId: 'req_123',
      },
    })

    expect(() =>
      errorResponseSchema.parse({
        error: {
          code: 'UNKNOWN',
          message: '失败',
          requestId: 'req_123',
        },
      }),
    ).toThrow()
  })
})
