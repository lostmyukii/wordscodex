import {
  createStudySessionRequestSchema,
  errorResponseSchema,
  studySessionResponseSchema,
  todayResponseSchema,
  type CreateStudySessionRequest,
  type StudySessionResponse,
  type TodayResponse,
} from '@wordscodex/contracts'

const configuredApiOrigin: unknown = import.meta.env.VITE_API_ORIGIN
const apiOrigin =
  typeof configuredApiOrigin === 'string' && configuredApiOrigin.length > 0
    ? configuredApiOrigin
    : 'http://localhost:3001'

export class StudyApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StudyApiError'
  }
}

async function request<T>(
  path: string,
  init: RequestInit,
  accessToken: string,
  parse: (value: unknown) => T,
) {
  const response = await fetch(`${apiOrigin}/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  })
  const body: unknown = await response.json()

  if (!response.ok) {
    const error = errorResponseSchema.parse(body)
    throw new StudyApiError(error.error.message)
  }

  return parse(body)
}

export type StudyClient = {
  getToday(accessToken: string): Promise<TodayResponse>
  createSession(
    input: CreateStudySessionRequest,
    accessToken: string,
  ): Promise<StudySessionResponse>
  getSession(
    sessionId: string,
    accessToken: string,
  ): Promise<StudySessionResponse>
}

export const studyApi: StudyClient = {
  getToday(accessToken) {
    return request(
      '/today',
      {
        method: 'GET',
      },
      accessToken,
      (value) => todayResponseSchema.parse(value),
    )
  },
  createSession(input, accessToken) {
    const payload = createStudySessionRequestSchema.parse(input)

    return request(
      '/study-sessions',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      accessToken,
      (value) => studySessionResponseSchema.parse(value),
    )
  },
  getSession(sessionId, accessToken) {
    return request(
      `/study-sessions/${encodeURIComponent(sessionId)}`,
      {
        method: 'GET',
      },
      accessToken,
      (value) => studySessionResponseSchema.parse(value),
    )
  },
}
