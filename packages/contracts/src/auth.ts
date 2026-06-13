import { z } from 'zod'

const emailSchema = z.string().trim().toLowerCase().email().max(254)
const authErrorCodes = [
  'VALIDATION_FAILED',
  'AUTH_CODE_RATE_LIMITED',
  'AUTH_CODE_INVALID',
  'AUTH_CODE_ATTEMPTS_EXCEEDED',
  'ACCOUNT_EMAIL_IN_USE',
  'UNAUTHORIZED',
] as const

export const userSchema = z.object({
  id: z.string().min(1),
  email: emailSchema.nullable(),
  displayName: z.string().min(1).max(80),
  role: z.enum(['learner', 'admin']),
  accountType: z.enum(['guest', 'registered']),
  timezone: z.string().min(1).max(100),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const requestCodeRequestSchema = z.object({
  email: emailSchema,
})

export const requestCodeResponseSchema = z.object({
  accepted: z.literal(true),
  expiresInSeconds: z.literal(600),
})

export const verifyCodeRequestSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/),
  timezone: z.string().min(1).max(100).default('Asia/Shanghai'),
})

export const guestLoginRequestSchema = z.object({
  timezone: z.string().min(1).max(100).default('Asia/Shanghai'),
})

export const authSessionResponseSchema = z.object({
  accessToken: z.string().min(1),
  expiresInSeconds: z.literal(900),
  user: userSchema,
})

export const authErrorCodeSchema = z.enum(authErrorCodes)
export const apiErrorCodeSchema = z.enum([
  ...authErrorCodes,
  'NOT_FOUND',
  'ACTIVE_STUDY_PLAN_EXISTS',
  'NO_ACTIVE_STUDY_PLAN',
  'EMPTY_STUDY_SESSION',
  'IDEMPOTENCY_KEY_REQUIRED',
  'STUDY_SESSION_INCOMPLETE',
])

export const errorResponseSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string().min(1),
    requestId: z.string().min(1),
  }),
})

export type User = z.infer<typeof userSchema>
export type RequestCodeRequest = z.infer<typeof requestCodeRequestSchema>
export type RequestCodeResponse = z.infer<typeof requestCodeResponseSchema>
export type VerifyCodeRequest = z.infer<typeof verifyCodeRequestSchema>
export type GuestLoginRequest = z.infer<typeof guestLoginRequestSchema>
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>
export type AuthErrorCode = z.infer<typeof authErrorCodeSchema>
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>
export type ErrorResponse = z.infer<typeof errorResponseSchema>
