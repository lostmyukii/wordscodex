import {
  errorResponseSchema,
  vocabularyBookDetailResponseSchema,
  vocabularyBookListResponseSchema,
  type ApiErrorCode,
  type VocabularyBookDetailResponse,
  type VocabularyBookListResponse,
} from '@wordscodex/contracts'

const configuredApiOrigin: unknown = import.meta.env.VITE_API_ORIGIN
const apiOrigin =
  typeof configuredApiOrigin === 'string' && configuredApiOrigin.length > 0
    ? configuredApiOrigin
    : 'http://localhost:3001'

export class VocabularyApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'VocabularyApiError'
  }
}

async function request<T>(path: string, parse: (value: unknown) => T) {
  const response = await fetch(`${apiOrigin}/api/v1${path}`, {
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
    },
  })
  const body: unknown = await response.json()

  if (!response.ok) {
    const error = errorResponseSchema.parse(body)
    throw new VocabularyApiError(error.error.code, error.error.message)
  }

  return parse(body)
}

export type VocabularyClient = {
  listBooks(input: { q?: string }): Promise<VocabularyBookListResponse>
  getBook(bookId: string): Promise<VocabularyBookDetailResponse>
}

export const vocabularyApi: VocabularyClient = {
  listBooks(input) {
    const params = new URLSearchParams()
    if (input.q) params.set('q', input.q)
    const query = params.toString()

    return request(`/vocabulary-books${query ? `?${query}` : ''}`, (value) =>
      vocabularyBookListResponseSchema.parse(value),
    )
  },
  getBook(bookId) {
    return request(`/vocabulary-books/${encodeURIComponent(bookId)}`, (value) =>
      vocabularyBookDetailResponseSchema.parse(value),
    )
  },
}
