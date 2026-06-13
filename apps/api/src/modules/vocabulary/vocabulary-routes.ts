import {
  vocabularyBookDetailResponseSchema,
  vocabularyBookListResponseSchema,
  vocabularyBookSearchQuerySchema,
  type VocabularyBook,
} from '@wordscodex/contracts'
import type { FastifyPluginCallback } from 'fastify'
import { z, ZodError } from 'zod'
import { HttpError } from '../../shared/http-error.js'

export type VocabularyRepository = {
  listBooks(input: { q?: string }): Promise<VocabularyBook[]>
  findBook(bookId: string): Promise<VocabularyBook | null>
}

type VocabularyRoutesOptions = {
  vocabularyRepository: VocabularyRepository
}

export const vocabularyRoutes: FastifyPluginCallback<
  VocabularyRoutesOptions
> = (app, options, done) => {
  app.get('/vocabulary-books', async (request) => {
    const query = parseQuery(request.query)
    const books = await options.vocabularyRepository.listBooks(
      query.q ? { q: query.q } : {},
    )

    return vocabularyBookListResponseSchema.parse({
      books,
    })
  })

  app.get('/vocabulary-books/:bookId', async (request) => {
    const params = parseParams(request.params)
    const book = await options.vocabularyRepository.findBook(params.bookId)

    if (!book) {
      throw new HttpError(404, 'NOT_FOUND', '词库不存在。')
    }

    return vocabularyBookDetailResponseSchema.parse({
      book,
    })
  })

  done()
}

function parseQuery(query: unknown) {
  try {
    return vocabularyBookSearchQuerySchema.parse(query)
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpError(
        400,
        'VALIDATION_FAILED',
        '提交内容不完整，请检查后重试。',
      )
    }
    throw error
  }
}

function parseParams(params: unknown) {
  try {
    return bookParamsSchema.parse(params)
  } catch (error) {
    if (!(error instanceof ZodError)) throw error
    throw new HttpError(
      400,
      'VALIDATION_FAILED',
      '提交内容不完整，请检查后重试。',
    )
  }
}

const bookParamsSchema = z.object({
  bookId: z.string().trim().min(1).max(120),
})
