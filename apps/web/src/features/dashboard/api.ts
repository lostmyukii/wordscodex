import {
  dashboardSummaryResponseSchema,
  errorResponseSchema,
  type DashboardSummaryResponse,
} from '@wordscodex/contracts'

const configuredApiOrigin: unknown = import.meta.env.VITE_API_ORIGIN
const apiOrigin =
  typeof configuredApiOrigin === 'string' && configuredApiOrigin.length > 0
    ? configuredApiOrigin
    : 'http://localhost:3001'

export class DashboardApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DashboardApiError'
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

  const response = await fetch(`${apiOrigin}/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers,
  })
  const body: unknown = await response.json()

  if (!response.ok) {
    const error = errorResponseSchema.parse(body)
    throw new DashboardApiError(error.error.message)
  }

  return parse(body)
}

export type DashboardClient = {
  getSummary(accessToken: string): Promise<DashboardSummaryResponse>
}

export const dashboardApi: DashboardClient = {
  getSummary(accessToken) {
    return request(
      '/dashboard/summary',
      {
        method: 'GET',
      },
      accessToken,
      (value) => dashboardSummaryResponseSchema.parse(value),
    )
  },
}
