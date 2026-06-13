import { z } from 'zod'
import { studyPlanSchema } from './study-plan.js'

export const masteryStateSchema = z.enum([
  'new',
  'learning',
  'fuzzy',
  'mistake',
  'mastered',
  'lapsed',
])

export const studySessionModeSchema = z.enum([
  'new_words',
  'review',
  'mistake_drill',
  'mixed',
])

export const studySessionStatusSchema = z.enum([
  'active',
  'completed',
  'abandoned',
])

export const questionTypeSchema = z.enum([
  'word_to_meaning',
  'meaning_to_word',
  'spelling',
  'listening',
])

export const reviewRatingSchema = z.enum(['again', 'hard', 'good', 'easy'])

export const wordMeaningSchema = z.object({
  partOfSpeech: z.string().min(1),
  definitionZh: z.string().min(1),
  definitionEn: z.string().min(1).nullable(),
})

export const wordExampleSchema = z.object({
  sentence: z.string().min(1),
  translationZh: z.string().min(1),
  source: z.string().min(1).nullable(),
})

export const wordSchema = z.object({
  id: z.string().min(1),
  lemma: z.string().min(1),
  phoneticUk: z.string().min(1).nullable(),
  phoneticUs: z.string().min(1).nullable(),
  audioUkUrl: z.string().url().nullable(),
  audioUsUrl: z.string().url().nullable(),
  imageUrl: z.string().url().nullable(),
  meanings: z.array(wordMeaningSchema).min(1),
  examples: z.array(wordExampleSchema),
})

export const todayTaskSchema = z.object({
  type: z.enum(['review', 'new_words']),
  title: z.string().min(1),
  count: z.number().int().nonnegative(),
  description: z.string().min(1),
})

export const todayResponseSchema = z.object({
  plan: studyPlanSchema.nullable(),
  summary: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    newWordsDue: z.number().int().nonnegative(),
    reviewsDue: z.number().int().nonnegative(),
    completedSessions: z.number().int().nonnegative(),
    canCheckIn: z.boolean(),
  }),
  tasks: z.array(todayTaskSchema),
  nextSessionRecommendation: z
    .object({
      mode: studySessionModeSchema,
      newWordLimit: z.number().int().nonnegative(),
      reviewLimit: z.number().int().nonnegative(),
    })
    .nullable(),
})

export const createStudySessionRequestSchema = z.object({
  mode: studySessionModeSchema.default('mixed'),
  newWordLimit: z.number().int().min(0).max(100).default(10),
  reviewLimit: z.number().int().min(0).max(200).default(30),
})

export const studySessionItemSchema = z.object({
  id: z.string().min(1),
  position: z.number().int().positive(),
  questionType: questionTypeSchema,
  word: wordSchema,
})

export const studySessionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  mode: studySessionModeSchema,
  status: studySessionStatusSchema,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  items: z.array(studySessionItemSchema),
})

export const studySessionResponseSchema = z.object({
  session: studySessionSchema,
})

export const submitReviewRequestSchema = z.object({
  wordId: z.string().min(1),
  questionType: questionTypeSchema,
  rating: reviewRatingSchema,
  isCorrect: z.boolean(),
  responseMs: z
    .number()
    .int()
    .positive()
    .max(10 * 60 * 1000),
  answer: z.string().trim().min(1).max(500).nullable(),
  reviewedAt: z.string().datetime(),
})

export const reviewProgressSchema = z.object({
  masteryState: masteryStateSchema,
  repetitions: z.number().int().nonnegative(),
  consecutiveCorrect: z.number().int().nonnegative(),
  correctCount: z.number().int().nonnegative(),
  incorrectCount: z.number().int().nonnegative(),
  easeFactor: z.number().min(1.3).max(3),
  intervalDays: z.number().int().nonnegative(),
  lastReviewedAt: z.string().datetime().nullable(),
  nextReviewAt: z.string().datetime().nullable(),
  averageResponseMs: z.number().int().positive().nullable(),
  lastErrorType: questionTypeSchema.nullable(),
})

export const submitReviewResponseSchema = z.object({
  progress: reviewProgressSchema,
  alreadyProcessed: z.boolean(),
})

export type MasteryState = z.infer<typeof masteryStateSchema>
export type QuestionType = z.infer<typeof questionTypeSchema>
export type ReviewRating = z.infer<typeof reviewRatingSchema>
export type StudySessionMode = z.infer<typeof studySessionModeSchema>
export type StudySessionStatus = z.infer<typeof studySessionStatusSchema>
export type Word = z.infer<typeof wordSchema>
export type TodayTask = z.infer<typeof todayTaskSchema>
export type TodayResponse = z.infer<typeof todayResponseSchema>
export type CreateStudySessionRequest = z.infer<
  typeof createStudySessionRequestSchema
>
export type StudySession = z.infer<typeof studySessionSchema>
export type StudySessionResponse = z.infer<typeof studySessionResponseSchema>
export type SubmitReviewRequest = z.infer<typeof submitReviewRequestSchema>
export type ReviewProgress = z.infer<typeof reviewProgressSchema>
export type SubmitReviewResponse = z.infer<typeof submitReviewResponseSchema>
export type SubmitReviewResult = SubmitReviewResponse
