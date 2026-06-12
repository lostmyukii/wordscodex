import {
  authSessionResponseSchema,
  guestLoginRequestSchema,
  requestCodeRequestSchema,
  requestCodeResponseSchema,
  userSchema,
  verifyCodeRequestSchema,
} from '@wordscodex/contracts'
import type {
  FastifyPluginCallback,
  FastifyReply,
  FastifyRequest,
} from 'fastify'
import { ZodError, type ZodType } from 'zod'
import { HttpError } from '../../shared/http-error.js'
import type { AuthService } from './auth-service.js'

export const refreshCookieName = 'wordscodex_refresh'

const refreshCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/api/v1/auth',
  maxAge: 30 * 24 * 60 * 60,
}

type AuthRoutesOptions = {
  authService: AuthService
  secureCookies: boolean
}

export const authRoutes: FastifyPluginCallback<AuthRoutesOptions> = (
  app,
  options,
  done,
) => {
  app.post(
    '/auth/request-code',
    {
      config: {
        rateLimit: {
          max: 1,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const input = parseBody(request, requestCodeRequestSchema)
      const response = await options.authService.requestCode(input)

      return reply.code(202).send(requestCodeResponseSchema.parse(response))
    },
  )

  app.post(
    '/auth/verify-code',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const input = parseBody(request, verifyCodeRequestSchema)
      const guestAccessToken = extractBearerToken(request)
      const result = await options.authService.verifyCode({
        ...input,
        ...(guestAccessToken ? { guestAccessToken } : {}),
      })

      setRefreshCookie(reply, result.refreshToken, options.secureCookies)
      return reply.send(authSessionResponseSchema.parse(result.response))
    },
  )

  app.post(
    '/auth/guest',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
        },
      },
    },
    async (request, reply) => {
      const input = parseBody(request, guestLoginRequestSchema)
      const result = await options.authService.createGuest(input)

      setRefreshCookie(reply, result.refreshToken, options.secureCookies)
      return reply.send(authSessionResponseSchema.parse(result.response))
    },
  )

  app.post('/auth/refresh', async (request, reply) => {
    const refreshToken = request.cookies[refreshCookieName]
    if (!refreshToken) {
      throw new HttpError(401, 'UNAUTHORIZED', '登录状态已失效，请重新登录。')
    }

    const result = await options.authService.refresh({ refreshToken })

    setRefreshCookie(reply, result.refreshToken, options.secureCookies)
    return reply.send(authSessionResponseSchema.parse(result.response))
  })

  app.post('/auth/logout', async (request, reply) => {
    await options.authService.logout(request.cookies[refreshCookieName])

    clearRefreshCookie(reply, options.secureCookies)
    return reply.code(204).send()
  })

  app.get('/me', async (request) => {
    const accessToken = extractBearerToken(request)
    if (!accessToken) {
      throw new HttpError(401, 'UNAUTHORIZED', '登录状态已失效，请重新登录。')
    }

    return userSchema.parse(
      await options.authService.getCurrentUser(accessToken),
    )
  })

  done()
}

function parseBody<T>(request: FastifyRequest, schema: ZodType<T>) {
  try {
    return schema.parse(request.body)
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpError(
        400,
        'VALIDATION_FAILED',
        '提交内容不完整，请检查后重试。',
      )
    }
    throw error
  }
}

function extractBearerToken(request: FastifyRequest) {
  const authorization = request.headers.authorization
  if (!authorization?.startsWith('Bearer ')) return undefined

  return authorization.slice('Bearer '.length).trim() || undefined
}

function setRefreshCookie(
  reply: FastifyReply,
  refreshToken: string,
  secure: boolean,
) {
  reply.setCookie(refreshCookieName, refreshToken, {
    ...refreshCookieOptions,
    secure,
  })
}

function clearRefreshCookie(reply: FastifyReply, secure: boolean) {
  reply.setCookie(refreshCookieName, '', {
    ...refreshCookieOptions,
    secure,
    maxAge: 0,
  })
}
