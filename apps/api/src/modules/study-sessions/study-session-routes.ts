import {
  completeStudySessionResponseSchema,
  createStudySessionRequestSchema,
  studySessionResultResponseSchema,
  submitReviewRequestSchema,
  submitReviewResponseSchema,
  studySessionResponseSchema,
  todayResponseSchema,
  type CompleteStudySessionResponse,
  type StudyPlan,
  type StudySession,
  type StudySessionResponse,
  type StudySessionResult,
  type SubmitReviewRequest,
  type SubmitReviewResult,
} from '@wordscodex/contracts'
import { buildTodayTasks } from '@wordscodex/domain'
import type { FastifyPluginCallback, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { HttpError } from '../../shared/http-error.js'
import type { AuthService } from '../auth/auth-service.js'

export class EmptyStudySessionError extends Error {}
export class IncompleteStudySessionError extends Error {}
export class NoActiveStudyPlanError extends Error {}

export type TodayOverview = {
  plan: StudyPlan
  dueReviewCount: number
  newWordsAvailable: number
  completedSessions: number
}

export type StudySessionRepository = {
  getTodayOverview(userId: string, now: Date): Promise<TodayOverview | null>
  createSession(input: {
    userId: string
    mode: StudySession['mode']
    newWordLimit: number
    reviewLimit: number
    now: Date
  }): Promise<StudySession>
  getSession(
    sessionId: string,
    userId: string,
  ): Promise<StudySessionResponse | null>
  submitReview(input: {
    sessionId: string
    userId: string
    idempotencyKey: string
    review: SubmitReviewRequest
    now: Date
  }): Promise<SubmitReviewResult | null>
  completeSession(input: {
    sessionId: string
    userId: string
    now: Date
  }): Promise<CompleteStudySessionResponse | null>
  getSessionResult(
    sessionId: string,
    userId: string,
  ): Promise<StudySessionResult | null>
}

type StudySessionRoutesOptions = {
  authService: AuthService
  studySessionRepository: StudySessionRepository
  clock: () => Date
}

export const studySessionRoutes: FastifyPluginCallback<
  StudySessionRoutesOptions
> = (app, options, done) => {
  app.get('/today', async (request) => {
    const user = await requireCurrentUser(request, options.authService)
    const now = options.clock()
    const overview = await options.studySessionRepository.getTodayOverview(
      user.id,
      now,
    )

    if (!overview) {
      return todayResponseSchema.parse({
        plan: null,
        summary: {
          date: toDateKey(now),
          newWordsDue: 0,
          reviewsDue: 0,
          completedSessions: 0,
          canCheckIn: false,
        },
        tasks: [],
        nextSessionRecommendation: null,
      })
    }

    const tasks = buildTodayTasks({
      hasActivePlan: true,
      dueReviewCount: overview.dueReviewCount,
      newWordsAvailable: overview.newWordsAvailable,
      dailyNewWordTarget: overview.plan.dailyNewWordTarget,
      dailyReviewLimit: overview.plan.dailyReviewLimit,
    })
    const reviewsDue = tasks.find((task) => task.type === 'review')?.count ?? 0
    const newWordsDue =
      tasks.find((task) => task.type === 'new_words')?.count ?? 0

    return todayResponseSchema.parse({
      plan: overview.plan,
      summary: {
        date: toDateKey(now),
        newWordsDue,
        reviewsDue,
        completedSessions: overview.completedSessions,
        canCheckIn: overview.completedSessions > 0,
      },
      tasks,
      nextSessionRecommendation: buildSessionRecommendation(
        newWordsDue,
        reviewsDue,
      ),
    })
  })

  app.post('/study-sessions', async (request, reply) => {
    const user = await requireCurrentUser(request, options.authService)
    const input = parseCreateBody(request.body)

    try {
      const session = await options.studySessionRepository.createSession({
        userId: user.id,
        mode: input.mode,
        newWordLimit: input.newWordLimit,
        reviewLimit: input.reviewLimit,
        now: options.clock(),
      })

      return reply.code(201).send(studySessionResponseSchema.parse({ session }))
    } catch (error) {
      if (error instanceof NoActiveStudyPlanError) {
        throw new HttpError(
          409,
          'NO_ACTIVE_STUDY_PLAN',
          '还没有进行中的学习计划。',
        )
      }
      if (error instanceof EmptyStudySessionError) {
        throw new HttpError(
          409,
          'EMPTY_STUDY_SESSION',
          '今日暂无可学习的新词。',
        )
      }
      throw error
    }
  })

  app.get('/study-sessions/:sessionId', async (request) => {
    const user = await requireCurrentUser(request, options.authService)
    const sessionId = getSessionId(request.params)
    const response = await options.studySessionRepository.getSession(
      sessionId,
      user.id,
    )

    if (!response) {
      throw new HttpError(404, 'NOT_FOUND', '学习会话不存在。')
    }

    return studySessionResponseSchema.parse(response)
  })

  app.post('/study-sessions/:sessionId/reviews', async (request, reply) => {
    const user = await requireCurrentUser(request, options.authService)
    const sessionId = getSessionId(request.params)
    const idempotencyKey = getIdempotencyKey(request)
    const review = parseReviewBody(request.body)
    const result = await options.studySessionRepository.submitReview({
      sessionId,
      userId: user.id,
      idempotencyKey,
      review,
      now: options.clock(),
    })

    if (!result) {
      throw new HttpError(404, 'NOT_FOUND', '学习会话不存在。')
    }

    return reply
      .code(result.alreadyProcessed ? 200 : 201)
      .send(submitReviewResponseSchema.parse(result))
  })

  app.post('/study-sessions/:sessionId/complete', async (request) => {
    const user = await requireCurrentUser(request, options.authService)
    const sessionId = getSessionId(request.params)

    try {
      const result = await options.studySessionRepository.completeSession({
        sessionId,
        userId: user.id,
        now: options.clock(),
      })

      if (!result) {
        throw new HttpError(404, 'NOT_FOUND', '学习会话不存在。')
      }

      return completeStudySessionResponseSchema.parse(result)
    } catch (error) {
      if (error instanceof IncompleteStudySessionError) {
        throw new HttpError(
          409,
          'STUDY_SESSION_INCOMPLETE',
          '还有题目没有完成作答。',
        )
      }
      throw error
    }
  })

  app.get('/study-sessions/:sessionId/result', async (request) => {
    const user = await requireCurrentUser(request, options.authService)
    const sessionId = getSessionId(request.params)
    const result = await options.studySessionRepository.getSessionResult(
      sessionId,
      user.id,
    )

    if (!result) {
      throw new HttpError(404, 'NOT_FOUND', '学习结果不存在。')
    }

    return studySessionResultResponseSchema.parse({ result })
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
    return createStudySessionRequestSchema.parse(body)
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

function parseReviewBody(body: unknown) {
  try {
    return submitReviewRequestSchema.parse(body)
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

function getSessionId(params: unknown) {
  if (
    typeof params === 'object' &&
    params !== null &&
    'sessionId' in params &&
    typeof params.sessionId === 'string' &&
    params.sessionId.trim().length > 0
  ) {
    return params.sessionId
  }

  throw new HttpError(
    400,
    'VALIDATION_FAILED',
    '提交内容不完整，请检查后重试。',
  )
}

function extractBearerToken(request: FastifyRequest) {
  const authorization = request.headers.authorization
  if (!authorization?.startsWith('Bearer ')) return undefined

  return authorization.slice('Bearer '.length).trim() || undefined
}

function getIdempotencyKey(request: FastifyRequest) {
  const value = request.headers['idempotency-key']
  const idempotencyKey = Array.isArray(value) ? value[0] : value

  if (typeof idempotencyKey === 'string' && idempotencyKey.trim().length > 0) {
    return idempotencyKey.trim()
  }

  throw new HttpError(
    400,
    'IDEMPOTENCY_KEY_REQUIRED',
    '学习记录缺少幂等键，请重试。',
  )
}

function buildSessionRecommendation(newWordsDue: number, reviewsDue: number) {
  if (reviewsDue > 0 && newWordsDue > 0) {
    return {
      mode: 'mixed' as const,
      newWordLimit: newWordsDue,
      reviewLimit: reviewsDue,
    }
  }

  if (reviewsDue > 0) {
    return {
      mode: 'review' as const,
      newWordLimit: 0,
      reviewLimit: reviewsDue,
    }
  }

  if (newWordsDue > 0) {
    return {
      mode: 'new_words' as const,
      newWordLimit: newWordsDue,
      reviewLimit: 0,
    }
  }

  return null
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}
