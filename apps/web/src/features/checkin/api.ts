import {
  checkinListResponseSchema,
  createCheckinResponseSchema,
  errorResponseSchema,
  type CheckinListResponse,
  type CreateCheckinResponse,
} from '@wordscodex/contracts'

const configuredApiOrigin: unknown = import.meta.env.VITE_API_ORIGIN
const apiOrigin =
  typeof configuredApiOrigin === 'string' && configuredApiOrigin.length > 0
    ? configuredApiOrigin
    : 'http://localhost:3001'

export class CheckinApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CheckinApiError'
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
    throw new CheckinApiError(error.error.message)
  }

  return parse(body)
}

export type CheckinClient = {
  listCheckins(accessToken: string): Promise<CheckinListResponse>
  createCheckin(accessToken: string): Promise<CreateCheckinResponse>
}

export const checkinApi: CheckinClient = {
  listCheckins(accessToken) {
    return request(
      '/checkins',
      {
        method: 'GET',
      },
      accessToken,
      (value) => checkinListResponseSchema.parse(value),
    )
  },
  createCheckin(accessToken) {
    return request(
      '/checkins',
      {
        method: 'POST',
      },
      accessToken,
      (value) => createCheckinResponseSchema.parse(value),
    )
  },
}
