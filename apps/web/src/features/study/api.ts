import {
  completeStudySessionResponseSchema,
  createStudySessionRequestSchema,
  errorResponseSchema,
  studySessionResultResponseSchema,
  submitReviewRequestSchema,
  submitReviewResponseSchema,
  studySessionResponseSchema,
  todayResponseSchema,
  type CompleteStudySessionResponse,
  type CreateStudySessionRequest,
  type StudySessionResponse,
  type StudySessionResultResponse,
  type SubmitReviewRequest,
  type SubmitReviewResponse,
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
  submitReview(
    sessionId: string,
    input: SubmitReviewRequest,
    idempotencyKey: string,
    accessToken: string,
  ): Promise<SubmitReviewResponse>
  completeSession(
    sessionId: string,
    accessToken: string,
  ): Promise<CompleteStudySessionResponse>
  getSessionResult(
    sessionId: string,
    accessToken: string,
  ): Promise<StudySessionResultResponse>
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
  submitReview(sessionId, input, idempotencyKey, accessToken) {
    const payload = submitReviewRequestSchema.parse(input)

    return request(
      `/study-sessions/${encodeURIComponent(sessionId)}/reviews`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'idempotency-key': idempotencyKey,
        },
      },
      accessToken,
      (value) => submitReviewResponseSchema.parse(value),
    )
  },
  completeSession(sessionId, accessToken) {
    return request(
      `/study-sessions/${encodeURIComponent(sessionId)}/complete`,
      {
        method: 'POST',
      },
      accessToken,
      (value) => completeStudySessionResponseSchema.parse(value),
    )
  },
  getSessionResult(sessionId, accessToken) {
    return request(
      `/study-sessions/${encodeURIComponent(sessionId)}/result`,
      {
        method: 'GET',
      },
      accessToken,
      (value) => studySessionResultResponseSchema.parse(value),
    )
  },
}
