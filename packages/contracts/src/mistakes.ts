import { z } from 'zod'
import { studyPlanSchema } from './study-plan.js'
import { questionTypeSchema, wordSchema } from './study-session.js'

export const mistakeMasteryStateSchema = z.enum(['fuzzy', 'mistake', 'lapsed'])

export const mistakeListItemSchema = z.object({
  word: wordSchema,
  masteryState: mistakeMasteryStateSchema,
  repetitions: z.number().int().nonnegative(),
  correctCount: z.number().int().nonnegative(),
  incorrectCount: z.number().int().nonnegative(),
  lastReviewedAt: z.string().datetime().nullable(),
  nextReviewAt: z.string().datetime().nullable(),
  lastErrorType: questionTypeSchema.nullable(),
  updatedAt: z.string().datetime(),
})

export const mistakeListResponseSchema = z.object({
  plan: studyPlanSchema.nullable(),
  summary: z.object({
    total: z.number().int().nonnegative(),
    dueNow: z.number().int().nonnegative(),
  }),
  items: z.array(mistakeListItemSchema),
})

export const createMistakeDrillSessionRequestSchema = z.object({
  limit: z.number().int().min(1).max(50).default(20),
})

export type MistakeMasteryState = z.infer<typeof mistakeMasteryStateSchema>
export type MistakeListItem = z.infer<typeof mistakeListItemSchema>
export type MistakeListResponse = z.infer<typeof mistakeListResponseSchema>
export type CreateMistakeDrillSessionRequest = z.infer<
  typeof createMistakeDrillSessionRequestSchema
>
