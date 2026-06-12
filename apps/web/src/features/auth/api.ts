import {
  authSessionResponseSchema,
  errorResponseSchema,
  requestCodeResponseSchema,
  type AuthErrorCode,
  type AuthSessionResponse,
} from '@wordscodex/contracts'

const configuredApiOrigin: unknown = import.meta.env.VITE_API_ORIGIN
const apiOrigin =
  typeof configuredApiOrigin === 'string' && configuredApiOrigin.length > 0
    ? configuredApiOrigin
    : 'http://localhost:3001'

export class AuthApiError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'AuthApiError'
  }
}

async function request<T>(
  path: string,
  init: RequestInit,
  parse: (value: unknown) => T,
) {
  const response = await fetch(`${apiOrigin}/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...init.headers,
    },
  })
  const body: unknown = response.status === 204 ? null : await response.json()

  if (!response.ok) {
    const error = errorResponseSchema.parse(body)
    throw new AuthApiError(error.error.code, error.error.message)
  }

  return parse(body)
}

export type AuthClient = {
  requestCode(email: string): Promise<{ accepted: true; expiresInSeconds: 600 }>
  verifyCode(input: {
    email: string
    code: string
    timezone: string
    accessToken?: string | undefined
  }): Promise<AuthSessionResponse>
  guest(timezone: string): Promise<AuthSessionResponse>
  refresh(): Promise<AuthSessionResponse>
}

export const authApi: AuthClient = {
  requestCode(email: string) {
    return request(
      '/auth/request-code',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      },
      (value) => requestCodeResponseSchema.parse(value),
    )
  },
  verifyCode(input) {
    const headers = input.accessToken
      ? { authorization: `Bearer ${input.accessToken}` }
      : undefined

    return request(
      '/auth/verify-code',
      {
        method: 'POST',
        body: JSON.stringify(input),
        ...(headers ? { headers } : {}),
      },
      (value) => authSessionResponseSchema.parse(value),
    )
  },
  guest(timezone: string) {
    return request(
      '/auth/guest',
      {
        method: 'POST',
        body: JSON.stringify({ timezone }),
      },
      (value) => authSessionResponseSchema.parse(value),
    )
  },
  refresh() {
    return request(
      '/auth/refresh',
      {
        method: 'POST',
      },
      (value) => authSessionResponseSchema.parse(value),
    )
  },
}
