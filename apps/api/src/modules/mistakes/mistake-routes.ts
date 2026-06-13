import {
  createMistakeDrillSessionRequestSchema,
  mistakeListResponseSchema,
  studySessionResponseSchema,
  type MistakeListResponse,
  type StudySession,
} from '@wordscodex/contracts'
import type { FastifyPluginCallback, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { HttpError } from '../../shared/http-error.js'
import type { AuthService } from '../auth/auth-service.js'

export class NoActiveMistakePlanError extends Error {}
export class EmptyMistakeSessionError extends Error {}

export type MistakeRepository = {
  listMistakes(userId: string, now: Date): Promise<MistakeListResponse>
  createMistakeDrillSession(input: {
    userId: string
    limit: number
    now: Date
  }): Promise<StudySession>
}

type MistakeRoutesOptions = {
  authService: AuthService
  mistakeRepository: MistakeRepository
  clock: () => Date
}

export const mistakeRoutes: FastifyPluginCallback<MistakeRoutesOptions> = (
  app,
  options,
  done,
) => {
  app.get('/mistakes', async (request) => {
    const user = await requireCurrentUser(request, options.authService)
    const response = await options.mistakeRepository.listMistakes(
      user.id,
      options.clock(),
    )

    return mistakeListResponseSchema.parse(response)
  })

  app.post('/mistakes/session', async (request, reply) => {
    const user = await requireCurrentUser(request, options.authService)
    const input = parseCreateBody(request.body)

    try {
      const session = await options.mistakeRepository.createMistakeDrillSession(
        {
          userId: user.id,
          limit: input.limit,
          now: options.clock(),
        },
      )

      return reply.code(201).send(studySessionResponseSchema.parse({ session }))
    } catch (error) {
      if (error instanceof NoActiveMistakePlanError) {
        throw new HttpError(
          409,
          'NO_ACTIVE_STUDY_PLAN',
          '还没有进行中的学习计划。',
        )
      }
      if (error instanceof EmptyMistakeSessionError) {
        throw new HttpError(
          409,
          'EMPTY_MISTAKE_SESSION',
          '暂无需要强化的错词。',
        )
      }
      throw error
    }
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

function parseCreateBody(body: unknown) {
  try {
    return createMistakeDrillSessionRequestSchema.parse(body)
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
