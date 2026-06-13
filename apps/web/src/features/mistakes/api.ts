import {
  createMistakeDrillSessionRequestSchema,
  errorResponseSchema,
  mistakeListResponseSchema,
  studySessionResponseSchema,
  type CreateMistakeDrillSessionRequest,
  type MistakeListResponse,
  type StudySessionResponse,
} from '@wordscodex/contracts'

const configuredApiOrigin: unknown = import.meta.env.VITE_API_ORIGIN
const apiOrigin =
  typeof configuredApiOrigin === 'string' && configuredApiOrigin.length > 0
    ? configuredApiOrigin
    : 'http://localhost:3001'

export class MistakesApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MistakesApiError'
  }
}

async function request<T>(
  path: string,
  init: RequestInit,
  accessToken: string,
  parse: (value: unknown) => T,
) {
  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${accessToken}`)
  if (init.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  const response = await fetch(`${apiOrigin}/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers,
  })
  const body: unknown = await response.json()

  if (!response.ok) {
    const error = errorResponseSchema.parse(body)
    throw new MistakesApiError(error.error.message)
  }

  return parse(body)
}

export type MistakesClient = {
  listMistakes(accessToken: string): Promise<MistakeListResponse>
  createMistakeDrillSession(
    input: CreateMistakeDrillSessionRequest,
    accessToken: string,
  ): Promise<StudySessionResponse>
}

export const mistakesApi: MistakesClient = {
  listMistakes(accessToken) {
    return request(
      '/mistakes',
      {
        method: 'GET',
      },
      accessToken,
      (value) => mistakeListResponseSchema.parse(value),
    )
  },
  createMistakeDrillSession(input, accessToken) {
    const payload = createMistakeDrillSessionRequestSchema.parse(input)

    return request(
      '/mistakes/session',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      accessToken,
      (value) => studySessionResponseSchema.parse(value),
    )
  },
}
