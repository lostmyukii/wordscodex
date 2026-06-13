import {
  analyticsSummaryQuerySchema,
  analyticsSummaryResponseSchema,
  createAnalyticsEventRequestSchema,
  createAnalyticsEventResponseSchema,
  type AnalyticsSummaryResponse,
  type CreateAnalyticsEventRequest,
  type CreateAnalyticsEventResponse,
} from '@wordscodex/contracts'
import type { FastifyPluginCallback, FastifyRequest } from 'fastify'
import { HttpError } from '../../shared/http-error.js'
import { AuthServiceError, type AuthService } from '../auth/auth-service.js'

export type AnalyticsRepository = {
  recordEvent(
    input: CreateAnalyticsEventRequest & {
      userId: string | null
    },
  ): Promise<CreateAnalyticsEventResponse>
  getSummary(input: {
    days: number
    now: Date
  }): Promise<AnalyticsSummaryResponse>
}

type AnalyticsRoutesOptions = {
  authService: AuthService
  analyticsRepository: AnalyticsRepository
  clock?: () => Date
}

export const analyticsRoutes: FastifyPluginCallback<AnalyticsRoutesOptions> = (
  app,
  options,
  done,
) => {
  app.post('/analytics/events', async (request, reply) => {
    const payload = createAnalyticsEventRequestSchema.parse(request.body)
    const userId = await getOptionalCurrentUserId(request, options.authService)
    const response = await options.analyticsRepository.recordEvent({
      ...payload,
      userId,
    })

    return reply
      .code(response.alreadyProcessed ? 200 : 201)
      .send(createAnalyticsEventResponseSchema.parse(response))
  })

  app.get('/analytics/summary', async (request) => {
    await getRequiredCurrentUserId(request, options.authService)
    const query = analyticsSummaryQuerySchema.parse(request.query)
    const response = await options.analyticsRepository.getSummary({
      days: query.days,
      now: options.clock?.() ?? new Date(),
    })

    return analyticsSummaryResponseSchema.parse(response)
  })

  done()
}

async function getOptionalCurrentUserId(
  request: FastifyRequest,
  authService: AuthService,
) {
  const accessToken = extractBearerToken(request)
  if (!accessToken) return null

  try {
    const user = await authService.getCurrentUser(accessToken)
    return user.id
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw new HttpError(401, error.code, '登录状态已失效，请重新登录。')
    }
    throw error
  }
}

async function getRequiredCurrentUserId(
  request: FastifyRequest,
  authService: AuthService,
) {
  const accessToken = extractBearerToken(request)
  if (!accessToken) {
    throw new HttpError(401, 'UNAUTHORIZED', '登录状态已失效，请重新登录。')
  }

  try {
    const user = await authService.getCurrentUser(accessToken)
    return user.id
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw new HttpError(401, error.code, '登录状态已失效，请重新登录。')
    }
    throw error
  }
}

function extractBearerToken(request: FastifyRequest) {
  const authorization = request.headers.authorization
  if (!authorization?.startsWith('Bearer ')) return undefined

  return authorization.slice('Bearer '.length).trim() || undefined
}
