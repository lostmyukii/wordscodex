import { describe, expect, it } from 'vitest'
import {
  authSessionResponseSchema,
  errorResponseSchema,
  guestLoginRequestSchema,
  requestCodeRequestSchema,
  requestCodeResponseSchema,
  userSchema,
  verifyCodeRequestSchema,
} from './auth.js'

const user = {
  id: 'user_123',
  email: 'learner@example.com',
  displayName: '学习者',
  role: 'learner',
  accountType: 'registered',
  timezone: 'Asia/Shanghai',
  createdAt: '2026-06-12T00:00:00.000Z',
  updatedAt: '2026-06-12T00:00:00.000Z',
}

describe('authentication contracts', () => {
  it('normalizes a valid email request', () => {
    expect(
      requestCodeRequestSchema.parse({
        email: '  Learner@Example.COM ',
      }),
    ).toEqual({
      email: 'learner@example.com',
    })
  })

  it('requires a six digit verification code', () => {
    expect(() =>
      verifyCodeRequestSchema.parse({
        email: 'learner@example.com',
        code: '12345',
        timezone: 'Asia/Shanghai',
      }),
    ).toThrow()
  })

  it('accepts the public user and session payload', () => {
    expect(userSchema.parse(user)).toEqual(user)
    expect(
      authSessionResponseSchema.parse({
        accessToken: 'access-token',
        expiresInSeconds: 900,
        user,
      }),
    ).toMatchObject({
      expiresInSeconds: 900,
      user,
    })
  })

  it('accepts guest and request-code payloads', () => {
    expect(guestLoginRequestSchema.parse({})).toEqual({
      timezone: 'Asia/Shanghai',
    })
    expect(
      requestCodeResponseSchema.parse({
        accepted: true,
        expiresInSeconds: 600,
      }),
    ).toEqual({
      accepted: true,
      expiresInSeconds: 600,
    })
  })

  it('rejects unknown user roles and unstable error codes', () => {
    expect(() =>
      userSchema.parse({
        ...user,
        role: 'owner',
      }),
    ).toThrow()
    expect(() =>
      errorResponseSchema.parse({
        error: {
          code: 'UNKNOWN',
          message: '失败',
          requestId: 'req_123',
        },
      }),
    ).toThrow()
  })
})
