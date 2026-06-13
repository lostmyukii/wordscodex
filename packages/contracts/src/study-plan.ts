import { z } from 'zod'

export const learningGoalSchema = z.enum([
  'k12',
  'college',
  'postgraduate',
  'overseas',
  'workplace',
])

export const studyPlanStatusSchema = z.enum(['active', 'paused', 'completed'])

export const studyPlanSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  vocabularyBookId: z.string().min(1),
  learningGoal: learningGoalSchema,
  dailyNewWordTarget: z.number().int().min(5).max(100),
  dailyReviewLimit: z.number().int().min(10).max(200),
  targetDate: z.string().datetime().nullable(),
  reminderEnabled: z.boolean(),
  status: studyPlanStatusSchema,
  startedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const createStudyPlanRequestSchema = z.object({
  vocabularyBookId: z.string().trim().min(1).max(120),
  learningGoal: learningGoalSchema,
  dailyNewWordTarget: z.number().int().min(5).max(100),
  dailyReviewLimit: z
    .preprocess(
      (value) => (value === undefined ? 80 : value),
      z.number().int().min(10).max(200),
    )
    .default(80),
  targetDate: z
    .preprocess(
      (value) => (value === undefined ? null : value),
      z.string().datetime().nullable(),
    )
    .default(null),
  reminderEnabled: z.boolean().default(false),
})

export const studyPlanResponseSchema = z.object({
  plan: studyPlanSchema,
})

export const activeStudyPlanResponseSchema = z.object({
  plan: studyPlanSchema.nullable(),
})

export type LearningGoal = z.infer<typeof learningGoalSchema>
export type StudyPlanStatus = z.infer<typeof studyPlanStatusSchema>
export type StudyPlan = z.infer<typeof studyPlanSchema>
export type CreateStudyPlanRequest = z.infer<
  typeof createStudyPlanRequestSchema
>
export type StudyPlanResponse = z.infer<typeof studyPlanResponseSchema>
export type ActiveStudyPlanResponse = z.infer<
  typeof activeStudyPlanResponseSchema
>
