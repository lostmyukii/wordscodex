import { describe, expect, it } from 'vitest'
import {
  authReadRateLimit,
  authWriteRateLimit,
  buildRefreshCookieOptions,
  loggerRedactionPaths,
} from './security.js'

describe('API security helpers', () => {
  it('redacts authentication, verification, and email fields from logs', () => {
    expect(loggerRedactionPaths).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers.set-cookie',
        'req.body.email',
        'req.body.code',
        'req.body.token',
        'req.body.accessToken',
        'req.body.refreshToken',
        'req.cookies.wordscodex_refresh',
      ]),
    )
  })

  it('builds a production-safe HttpOnly refresh cookie policy', () => {
    expect(buildRefreshCookieOptions({ secure: true })).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 30 * 24 * 60 * 60,
    })
  })

  it('defines rate limits for sensitive auth endpoints', () => {
    expect(authWriteRateLimit).toEqual({
      max: 20,
      timeWindow: '1 minute',
    })
    expect(authReadRateLimit).toEqual({
      max: 60,
      timeWindow: '1 minute',
    })
  })
})
