import {
  activeStudyPlanResponseSchema,
  createStudyPlanRequestSchema,
  studyPlanResponseSchema,
  type StudyPlan,
} from '@wordscodex/contracts'
import { calculatePlanTargetDate } from '@wordscodex/domain'
import type { FastifyPluginCallback, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { HttpError } from '../../shared/http-error.js'
import type { AuthService } from '../auth/auth-service.js'

export class ActiveStudyPlanExistsError extends Error {}

export type StudyPlanVocabularyBook = {
  id: string
  slug: string
  name: string
  wordCount: number
}

export type StudyPlanRepository = {
  findVocabularyBook(bookId: string): Promise<StudyPlanVocabularyBook | null>
  createActivePlan(input: {
    userId: string
    vocabularyBookId: string
    learningGoal: StudyPlan['learningGoal']
    dailyNewWordTarget: number
    dailyReviewLimit: number
    targetDate: Date
    reminderEnabled: boolean
    now: Date
  }): Promise<StudyPlan>
  getActivePlan(userId: string): Promise<StudyPlan | null>
}

type StudyPlanRoutesOptions = {
  authService: AuthService
  studyPlanRepository: StudyPlanRepository
  clock: () => Date
}

export const studyPlanRoutes: FastifyPluginCallback<StudyPlanRoutesOptions> = (
  app,
  options,
  done,
) => {
  app.post('/study-plans', async (request, reply) => {
    const user = await requireCurrentUser(request, options.authService)
    const input = parseCreateBody(request.body)
    const activePlan = await options.studyPlanRepository.getActivePlan(user.id)

    if (activePlan) {
      throw new HttpError(
        409,
        'ACTIVE_STUDY_PLAN_EXISTS',
        '已经有进行中的学习计划。',
      )
    }

    const book = await options.studyPlanRepository.findVocabularyBook(
      input.vocabularyBookId,
    )

    if (!book) {
      throw new HttpError(404, 'NOT_FOUND', '词库不存在。')
    }

    const now = options.clock()
    const targetDate = input.targetDate
      ? new Date(input.targetDate)
      : calculatePlanTargetDate({
          startDate: now,
          wordCount: book.wordCount,
          dailyNewWordTarget: input.dailyNewWordTarget,
        })

    try {
      const plan = await options.studyPlanRepository.createActivePlan({
        userId: user.id,
        vocabularyBookId: book.id,
        learningGoal: input.learningGoal,
        dailyNewWordTarget: input.dailyNewWordTarget,
        dailyReviewLimit: input.dailyReviewLimit,
        targetDate,
        reminderEnabled: input.reminderEnabled,
        now,
      })

      return reply.code(201).send(studyPlanResponseSchema.parse({ plan }))
    } catch (error) {
      if (error instanceof ActiveStudyPlanExistsError) {
        throw new HttpError(
          409,
          'ACTIVE_STUDY_PLAN_EXISTS',
          '已经有进行中的学习计划。',
        )
      }
      throw error
    }
  })

  app.get('/study-plans/active', async (request) => {
    const user = await requireCurrentUser(request, options.authService)
    const plan = await options.studyPlanRepository.getActivePlan(user.id)

    return activeStudyPlanResponseSchema.parse({ plan })
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
    return createStudyPlanRequestSchema.parse(body)
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
