import {
  createAnalyticsEventRequestSchema,
  createAnalyticsEventResponseSchema,
  errorResponseSchema,
  type ApiErrorCode,
  type CreateAnalyticsEventRequest,
  type CreateAnalyticsEventResponse,
} from '@wordscodex/contracts'

const configuredApiOrigin: unknown = import.meta.env.VITE_API_ORIGIN
const apiOrigin =
  typeof configuredApiOrigin === 'string' && configuredApiOrigin.length > 0
    ? configuredApiOrigin
    : 'http://localhost:3001'

export class AnalyticsApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AnalyticsApiError'
  }
}

export type AnalyticsApiClient = {
  send(
    input: CreateAnalyticsEventRequest,
    accessToken?: string,
  ): Promise<CreateAnalyticsEventResponse>
}

export const analyticsApi: AnalyticsApiClient = {
  async send(input, accessToken) {
    const payload = createAnalyticsEventRequestSchema.parse(input)
    const headers = new Headers({
      'content-type': 'application/json',
    })
    if (accessToken) headers.set('authorization', `Bearer ${accessToken}`)

    const response = await fetch(`${apiOrigin}/api/v1/analytics/events`, {
      method: 'POST',
      body: JSON.stringify(payload),
      credentials: 'include',
      headers,
    })
    const body: unknown = await response.json()

    if (!response.ok) {
      const error = errorResponseSchema.parse(body)
      throw new AnalyticsApiError(error.error.code, error.error.message)
    }

    return createAnalyticsEventResponseSchema.parse(body)
  },
}
