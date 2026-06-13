export const loggerRedactionPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers.set-cookie',
  'req.body.email',
  'req.body.code',
  'req.body.token',
  'req.body.accessToken',
  'req.body.refreshToken',
  'req.cookies.wordscodex_refresh',
] as const

export const authWriteRateLimit = {
  max: 20,
  timeWindow: '1 minute',
} as const

export const authReadRateLimit = {
  max: 60,
  timeWindow: '1 minute',
} as const

export function buildRefreshCookieOptions(input: { secure: boolean }) {
  return {
    httpOnly: true,
    secure: input.secure,
    sameSite: 'lax' as const,
    path: '/api/v1/auth',
    maxAge: 30 * 24 * 60 * 60,
  }
}
