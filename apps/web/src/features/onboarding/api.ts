import {
  activeStudyPlanResponseSchema,
  errorResponseSchema,
  studyPlanResponseSchema,
  type ActiveStudyPlanResponse,
  type CreateStudyPlanRequest,
  type StudyPlanResponse,
} from '@wordscodex/contracts'

const configuredApiOrigin: unknown = import.meta.env.VITE_API_ORIGIN
const apiOrigin =
  typeof configuredApiOrigin === 'string' && configuredApiOrigin.length > 0
    ? configuredApiOrigin
    : 'http://localhost:3001'

export class StudyPlanApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StudyPlanApiError'
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
    throw new StudyPlanApiError(error.error.message)
  }

  return parse(body)
}

export type StudyPlanClient = {
  getActivePlan(accessToken: string): Promise<ActiveStudyPlanResponse>
  createPlan(
    input: CreateStudyPlanRequest,
    accessToken: string,
  ): Promise<StudyPlanResponse>
}

export const studyPlanApi: StudyPlanClient = {
  getActivePlan(accessToken) {
    return request(
      '/study-plans/active',
      {
        method: 'GET',
      },
      accessToken,
      (value) => activeStudyPlanResponseSchema.parse(value),
    )
  },
  createPlan(input, accessToken) {
    return request(
      '/study-plans',
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
      accessToken,
      (value) => studyPlanResponseSchema.parse(value),
    )
  },
}
