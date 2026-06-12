import {
  authSessionResponseSchema,
  errorResponseSchema,
  type User,
} from '@wordscodex/contracts'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildApp } from '../../app.js'
import { AuthService, type AuthRepository } from './auth-service.js'
import { InMemoryVerificationCodeStore } from './code-store.js'
import { TokenService } from './token-service.js'

const refreshCookieName = 'wordscodex_refresh'
const fixedNow = new Date('2026-06-12T00:00:00.000Z')

type SessionRecord = {
  id: string
  userId: string
  refreshTokenHash: string
  expiresAt: Date
  revokedAt: Date | null
}

class MemoryAuthRepository implements AuthRepository {
  private readonly users = new Map<string, User>()
  private readonly userIdsByEmail = new Map<string, string>()
  private readonly sessions = new Map<string, SessionRecord>()
  private nextUserIndex = 1
  private nextSessionIndex = 1

  createGuest(timezone: string) {
    return Promise.resolve(
      this.saveUser({
        id: `user_${this.nextUserIndex.toString()}`,
        email: null,
        displayName: '学习者',
        role: 'learner',
        accountType: 'guest',
        timezone,
        createdAt: fixedNow.toISOString(),
        updatedAt: fixedNow.toISOString(),
      }),
    )
  }

  registerOrUpgrade(input: {
    email: string
    timezone: string
    guestUserId?: string
  }) {
    const existingUserId = this.userIdsByEmail.get(input.email)

    if (input.guestUserId) {
      if (existingUserId && existingUserId !== input.guestUserId) {
        const error = new Error('Email is already in use')
        error.name = 'EmailInUseError'
        return Promise.reject(error)
      }

      const guest = this.users.get(input.guestUserId)
      if (!guest) throw new Error('Guest user does not exist')
      return Promise.resolve(
        this.saveUser({
          ...guest,
          email: input.email,
          accountType: 'registered',
          timezone: input.timezone,
          updatedAt: fixedNow.toISOString(),
        }),
      )
    }

    if (existingUserId) {
      const existing = this.users.get(existingUserId)
      if (!existing) throw new Error('User index is corrupt')
      return Promise.resolve(existing)
    }

    return Promise.resolve(
      this.saveUser({
        id: `user_${this.nextUserIndex.toString()}`,
        email: input.email,
        displayName: '学习者',
        role: 'learner',
        accountType: 'registered',
        timezone: input.timezone,
        createdAt: fixedNow.toISOString(),
        updatedAt: fixedNow.toISOString(),
      }),
    )
  }

  findUserById(userId: string) {
    return Promise.resolve(this.users.get(userId) ?? null)
  }

  createSession(input: {
    userId: string
    refreshTokenHash: string
    expiresAt: Date
  }) {
    const session = {
      id: `session_${this.nextSessionIndex.toString()}`,
      userId: input.userId,
      refreshTokenHash: input.refreshTokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
    }
    this.nextSessionIndex += 1
    this.sessions.set(session.id, session)
    return Promise.resolve(session)
  }

  findSessionByHash(refreshTokenHash: string) {
    const session = [...this.sessions.values()].find(
      (candidate) => candidate.refreshTokenHash === refreshTokenHash,
    )
    if (!session) return Promise.resolve(null)
    return Promise.resolve({
      ...session,
      user: this.users.get(session.userId) ?? null,
    })
  }

  rotateSession(input: {
    sessionId: string
    currentRefreshTokenHash: string
    nextRefreshTokenHash: string
    expiresAt: Date
  }) {
    const session = this.sessions.get(input.sessionId)
    if (
      !session ||
      session.revokedAt ||
      session.refreshTokenHash !== input.currentRefreshTokenHash
    ) {
      return Promise.resolve(null)
    }

    session.refreshTokenHash = input.nextRefreshTokenHash
    session.expiresAt = input.expiresAt
    return Promise.resolve(session)
  }

  revokeSession(refreshTokenHash: string) {
    const session = [...this.sessions.values()].find(
      (candidate) => candidate.refreshTokenHash === refreshTokenHash,
    )
    if (session) session.revokedAt = fixedNow
    return Promise.resolve()
  }

  private saveUser(user: User) {
    const nextUser = { ...user }
    this.users.set(nextUser.id, nextUser)
    if (nextUser.email) this.userIdsByEmail.set(nextUser.email, nextUser.id)
    this.nextUserIndex += 1
    return nextUser
  }
}

function createAuthService() {
  return new AuthService({
    repository: new MemoryAuthRepository(),
    codeStore: new InMemoryVerificationCodeStore(),
    tokenService: new TokenService(
      'test-secret-at-least-thirty-two-characters',
    ),
    codeSender: {
      sendCode: () => Promise.resolve(),
    },
    nodeEnv: 'test',
    authDevCode: '123456',
  })
}

function getSetCookie(response: { headers: Record<string, unknown> }) {
  const header = response.headers['set-cookie']
  if (Array.isArray(header)) return header.join('; ')
  if (typeof header === 'string') return header
  return ''
}

function extractCookieHeader(setCookie: string) {
  return setCookie.split(';')[0] ?? ''
}

function expectRefreshCookiePolicy(setCookie: string) {
  expect(setCookie).toContain(`${refreshCookieName}=`)
  expect(setCookie).toContain('HttpOnly')
  expect(setCookie).toContain('SameSite=Lax')
  expect(setCookie).toContain('Path=/api/v1/auth')
}

async function requestCode(
  app: FastifyInstance,
  email = 'learner@example.com',
) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/request-code',
    payload: { email },
  })
}

async function loginWithCode(app: FastifyInstance) {
  await requestCode(app)
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/verify-code',
    payload: {
      email: 'learner@example.com',
      code: '123456',
      timezone: 'Asia/Shanghai',
    },
  })
}

describe('authentication routes', () => {
  let app: FastifyInstance

  beforeEach(() => {
    app = buildApp({
      authService: createAuthService(),
    })
  })

  afterEach(async () => {
    await app.close()
  })

  it('returns 202 without exposing the verification code', async () => {
    const response = await requestCode(app)

    expect(response.statusCode).toBe(202)
    expect(response.json()).toEqual({
      accepted: true,
      expiresInSeconds: 600,
    })
    expect(response.body).not.toContain('123456')
  })

  it('sets an HttpOnly refresh cookie after code verification', async () => {
    const response = await loginWithCode(app)
    const body = authSessionResponseSchema.parse(response.json())
    const setCookie = getSetCookie(response)

    expect(response.statusCode).toBe(200)
    expectRefreshCookiePolicy(setCookie)
    expect(JSON.stringify(body)).not.toContain(extractCookieHeader(setCookie))
    expect(body.user).toMatchObject({
      email: 'learner@example.com',
      accountType: 'registered',
    })
  })

  it('creates a guest and sets the same cookie policy', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/guest',
      payload: { timezone: 'Asia/Shanghai' },
    })
    const body = authSessionResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(200)
    expectRefreshCookiePolicy(getSetCookie(response))
    expect(body.user.accountType).toBe('guest')
  })

  it('rotates the cookie during refresh', async () => {
    const login = await loginWithCode(app)
    const initialCookie = extractCookieHeader(getSetCookie(login))

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: {
        cookie: initialCookie,
      },
    })
    const nextCookie = extractCookieHeader(getSetCookie(response))

    expect(response.statusCode).toBe(200)
    expect(authSessionResponseSchema.parse(response.json()).user.email).toBe(
      'learner@example.com',
    )
    expectRefreshCookiePolicy(getSetCookie(response))
    expect(nextCookie).not.toBe(initialCookie)
  })

  it('clears the cookie during idempotent logout', async () => {
    const login = await loginWithCode(app)

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: {
        cookie: extractCookieHeader(getSetCookie(login)),
      },
    })

    expect(response.statusCode).toBe(204)
    expect(getSetCookie(response)).toContain(`${refreshCookieName}=;`)
    expect(getSetCookie(response)).toContain('Max-Age=0')
  })

  it('returns the current user with a Bearer access token', async () => {
    const login = await loginWithCode(app)
    const accessToken = authSessionResponseSchema.parse(
      login.json(),
    ).accessToken

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      email: 'learner@example.com',
      accountType: 'registered',
    })
  })

  it('returns the standard error payload for invalid input', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/verify-code',
      payload: {
        email: 'not-an-email',
        code: '123',
        timezone: 'Asia/Shanghai',
      },
    })
    const body = errorResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(400)
    expect(body.error).toMatchObject({
      code: 'VALIDATION_FAILED',
      message: '提交内容不完整，请检查后重试。',
    })
    expect(body.error.requestId).toBeTruthy()
  })

  it('rejects repeated request-code calls with 429', async () => {
    expect((await requestCode(app)).statusCode).toBe(202)

    const response = await requestCode(app)
    const body = errorResponseSchema.parse(response.json())

    expect(response.statusCode).toBe(429)
    expect(body.error.code).toBe('AUTH_CODE_RATE_LIMITED')
  })
})
