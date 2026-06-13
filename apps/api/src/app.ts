import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import { PrismaPg } from '@prisma/adapter-pg'
import rateLimit from '@fastify/rate-limit'
import { createClient, type RedisClientType } from 'redis'
import { ZodError } from 'zod'
import type {
  ApiErrorCode,
  AuthErrorCode,
  ErrorResponse,
} from '@wordscodex/contracts'
import Fastify, { type FastifyReply } from 'fastify'
import { PrismaClient } from '../generated/prisma/client.js'
import {
  AuthService,
  AuthServiceError,
  type VerificationCodeSender,
} from './modules/auth/auth-service.js'
import { PrismaAuthRepository } from './modules/auth/auth-repository.js'
import { authRoutes } from './modules/auth/auth-routes.js'
import { RedisVerificationCodeStore } from './modules/auth/redis-code-store.js'
import { TokenService } from './modules/auth/token-service.js'
import { PrismaStudyPlanRepository } from './modules/study-plans/study-plan-repository.js'
import {
  studyPlanRoutes,
  type StudyPlanRepository,
} from './modules/study-plans/study-plan-routes.js'
import { PrismaStudySessionRepository } from './modules/study-sessions/study-session-repository.js'
import {
  studySessionRoutes,
  type StudySessionRepository,
} from './modules/study-sessions/study-session-routes.js'
import { PrismaVocabularyRepository } from './modules/vocabulary/vocabulary-repository.js'
import {
  vocabularyRoutes,
  type VocabularyRepository,
} from './modules/vocabulary/vocabulary-routes.js'
import { healthRoutes } from './routes/health.js'
import { HttpError } from './shared/http-error.js'

type NodeEnv = 'development' | 'test' | 'production'

type BuildAppConfig = {
  webOrigin: string
  nodeEnv: NodeEnv
  databaseUrl: string
  redisUrl: string
  jwtAccessSecret: string
  authDevCode?: string
}

export type BuildAppOptions = {
  authService?: AuthService
  config?: BuildAppConfig
  prismaClient?: PrismaClient
  redisClient?: RedisClientType
  vocabularyRepository?: VocabularyRepository
  studyPlanRepository?: StudyPlanRepository
  studySessionRepository?: StudySessionRepository
  clock?: () => Date
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: false,
  })
  const config = resolveConfig(options.config)
  const { authService, prismaClient, redisClient } = resolveAuthDependencies(
    options,
    config,
  )
  const vocabularyRepository =
    options.vocabularyRepository ??
    (prismaClient ? new PrismaVocabularyRepository(prismaClient) : undefined)
  const studyPlanRepository =
    options.studyPlanRepository ??
    (prismaClient ? new PrismaStudyPlanRepository(prismaClient) : undefined)
  const studySessionRepository =
    options.studySessionRepository ??
    (prismaClient ? new PrismaStudySessionRepository(prismaClient) : undefined)
  const clock = options.clock ?? (() => new Date())

  void app.register(cors, {
    origin: config.webOrigin,
    credentials: true,
  })
  void app.register(cookie)
  void app.register(rateLimit, {
    global: false,
  })
  void app.register(healthRoutes, {
    prefix: '/api/v1',
  })
  void app.register(authRoutes, {
    prefix: '/api/v1',
    authService,
    secureCookies: config.nodeEnv === 'production',
  })
  if (vocabularyRepository) {
    void app.register(vocabularyRoutes, {
      prefix: '/api/v1',
      vocabularyRepository,
    })
  }
  if (studyPlanRepository) {
    void app.register(studyPlanRoutes, {
      prefix: '/api/v1',
      authService,
      studyPlanRepository,
      clock,
    })
  }
  if (studySessionRepository) {
    void app.register(studySessionRoutes, {
      prefix: '/api/v1',
      authService,
      studySessionRepository,
      clock,
    })
  }

  if (redisClient) {
    app.addHook('onReady', async () => {
      if (!redisClient.isOpen) await redisClient.connect()
    })
    app.addHook('onClose', async () => {
      if (redisClient.isOpen) await redisClient.quit()
    })
  }

  if (prismaClient && !options.prismaClient) {
    app.addHook('onClose', async () => {
      await prismaClient.$disconnect()
    })
  }

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof HttpError) {
      return sendError(
        reply,
        request.id,
        error.statusCode,
        error.code,
        error.message,
      )
    }

    if (error instanceof AuthServiceError) {
      const statusCode = statusCodeForAuthError(error.code)
      return sendError(
        reply,
        request.id,
        statusCode,
        error.code,
        messageForError(error.code),
      )
    }

    if (error instanceof ZodError) {
      return sendError(
        reply,
        request.id,
        400,
        'VALIDATION_FAILED',
        messageForError('VALIDATION_FAILED'),
      )
    }

    if (isRateLimitError(error)) {
      return sendError(
        reply,
        request.id,
        429,
        'AUTH_CODE_RATE_LIMITED',
        messageForError('AUTH_CODE_RATE_LIMITED'),
      )
    }

    return sendError(
      reply,
      request.id,
      500,
      'VALIDATION_FAILED',
      '服务暂时不可用，请稍后重试。',
    )
  })

  return app
}

function resolveConfig(config: BuildAppConfig | undefined): BuildAppConfig {
  if (config) return config

  return {
    webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    nodeEnv: parseNodeEnv(process.env.NODE_ENV),
    databaseUrl:
      process.env.DATABASE_URL ??
      'postgresql://wordscodex:wordscodex@localhost:5432/wordscodex',
    redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
    jwtAccessSecret:
      process.env.JWT_ACCESS_SECRET ??
      'development-secret-at-least-thirty-two-characters',
    ...(process.env.AUTH_DEV_CODE
      ? { authDevCode: process.env.AUTH_DEV_CODE }
      : {}),
  }
}

function parseNodeEnv(value: string | undefined): NodeEnv {
  if (value === 'test' || value === 'production') return value
  return 'development'
}

function resolveAuthDependencies(
  options: BuildAppOptions,
  config: BuildAppConfig,
) {
  if (options.authService) {
    return {
      authService: options.authService,
      prismaClient: undefined,
      redisClient: undefined,
    }
  }

  const prismaClient =
    options.prismaClient ??
    new PrismaClient({
      adapter: new PrismaPg({
        connectionString: config.databaseUrl,
      }),
    })
  const redisClient =
    options.redisClient ??
    createClient({
      url: config.redisUrl,
    })

  return {
    authService: new AuthService({
      repository: new PrismaAuthRepository(prismaClient),
      codeStore: new RedisVerificationCodeStore(redisClient),
      tokenService: new TokenService(config.jwtAccessSecret),
      codeSender: createVerificationCodeSender(),
      nodeEnv: config.nodeEnv,
      ...(config.authDevCode ? { authDevCode: config.authDevCode } : {}),
    }),
    prismaClient,
    redisClient,
  }
}

function createVerificationCodeSender(): VerificationCodeSender {
  return {
    sendCode: () => Promise.resolve(),
  }
}

function sendError(
  reply: FastifyReply,
  requestId: string,
  statusCode: number,
  code: ApiErrorCode,
  message: string,
) {
  const response: ErrorResponse = {
    error: {
      code,
      message,
      requestId,
    },
  }

  return reply.code(statusCode).send(response)
}

function statusCodeForAuthError(code: AuthErrorCode) {
  switch (code) {
    case 'AUTH_CODE_RATE_LIMITED':
      return 429
    case 'ACCOUNT_EMAIL_IN_USE':
      return 409
    case 'UNAUTHORIZED':
    case 'AUTH_CODE_INVALID':
    case 'AUTH_CODE_ATTEMPTS_EXCEEDED':
      return 401
    case 'VALIDATION_FAILED':
      return 400
  }
}

function messageForError(code: AuthErrorCode) {
  switch (code) {
    case 'VALIDATION_FAILED':
      return '提交内容不完整，请检查后重试。'
    case 'AUTH_CODE_RATE_LIMITED':
      return '请求过于频繁，请稍后再试。'
    case 'AUTH_CODE_INVALID':
      return '验证码无效或已过期，请重新获取。'
    case 'AUTH_CODE_ATTEMPTS_EXCEEDED':
      return '验证码错误次数过多，请重新获取。'
    case 'ACCOUNT_EMAIL_IN_USE':
      return '该邮箱已被其他账号使用。'
    case 'UNAUTHORIZED':
      return '登录状态已失效，请重新登录。'
  }
}

function isRateLimitError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    error.statusCode === 429
  )
}
