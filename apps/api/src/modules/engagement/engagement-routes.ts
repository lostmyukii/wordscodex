import {
  checkinListResponseSchema,
  createCheckinResponseSchema,
  dashboardSummaryResponseSchema,
  dashboardTrendsResponseSchema,
  type CheckinListResponse,
  type CreateCheckinResponse,
  type DashboardSummaryResponse,
  type DashboardTrendsResponse,
} from '@wordscodex/contracts'
import type { FastifyPluginCallback, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { HttpError } from '../../shared/http-error.js'
import type { AuthService } from '../auth/auth-service.js'

export class CheckinNotAllowedError extends Error {}

export type EngagementRepository = {
  listCheckins(input: {
    userId: string
    timezone: string
    now: Date
  }): Promise<CheckinListResponse>
  createCheckin(input: {
    userId: string
    timezone: string
    now: Date
  }): Promise<CreateCheckinResponse>
  getDashboardSummary(input: {
    userId: string
    timezone: string
    now: Date
  }): Promise<DashboardSummaryResponse>
  getDashboardTrends(input: {
    userId: string
    timezone: string
    now: Date
    days: number
  }): Promise<DashboardTrendsResponse>
}

type EngagementRoutesOptions = {
  authService: AuthService
  engagementRepository: EngagementRepository
  clock: () => Date
}

const dashboardTrendsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(30).default(7),
})

export const engagementRoutes: FastifyPluginCallback<
  EngagementRoutesOptions
> = (app, options, done) => {
  app.get('/checkins', async (request) => {
    const user = await requireCurrentUser(request, options.authService)
    const response = await options.engagementRepository.listCheckins({
      userId: user.id,
      timezone: user.timezone,
      now: options.clock(),
    })

    return checkinListResponseSchema.parse(response)
  })

  app.post('/checkins', async (request, reply) => {
    const user = await requireCurrentUser(request, options.authService)

    try {
      const response = await options.engagementRepository.createCheckin({
        userId: user.id,
        timezone: user.timezone,
        now: options.clock(),
      })

      return reply
        .code(response.alreadyCheckedIn ? 200 : 201)
        .send(createCheckinResponseSchema.parse(response))
    } catch (error) {
      if (error instanceof CheckinNotAllowedError) {
        throw new HttpError(
          409,
          'CHECKIN_NOT_ALLOWED',
          '完成至少 1 个学习会话后才能打卡。',
        )
      }
      throw error
    }
  })

  app.get('/dashboard/summary', async (request) => {
    const user = await requireCurrentUser(request, options.authService)
    const response = await options.engagementRepository.getDashboardSummary({
      userId: user.id,
      timezone: user.timezone,
      now: options.clock(),
    })

    return dashboardSummaryResponseSchema.parse(response)
  })

  app.get('/dashboard/trends', async (request) => {
    const user = await requireCurrentUser(request, options.authService)
    const query = dashboardTrendsQuerySchema.parse(request.query)
    const response = await options.engagementRepository.getDashboardTrends({
      userId: user.id,
      timezone: user.timezone,
      now: options.clock(),
      days: query.days,
    })

    return dashboardTrendsResponseSchema.parse(response)
  })

  done()
}

async function requireCurrentUser(
  request: FastifyRequest,
  authService: AuthService,
) {
  const accessToken = extractBearerToken(request)
  if (!accessToken) {
    throw new HttpError(401, 'UNAUTHORIZED', '登录状态已失效，请重新登录。')
  }

  return authService.getCurrentUser(accessToken)
}

function extractBearerToken(request: FastifyRequest) {
  const authorization = request.headers.authorization
  if (!authorization?.startsWith('Bearer ')) return undefined

  return authorization.slice('Bearer '.length).trim() || undefined
}
