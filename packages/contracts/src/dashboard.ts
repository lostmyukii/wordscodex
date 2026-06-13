import { z } from 'zod'
import { dateKeySchema, recentCheckinDaySchema } from './checkin.js'
import { studyPlanSchema } from './study-plan.js'

export const dashboardSummaryResponseSchema = z.object({
  plan: studyPlanSchema.nullable(),
  today: z.object({
    dateKey: dateKeySchema,
    completedSessions: z.number().int().nonnegative(),
    canCheckIn: z.boolean(),
    checkedInToday: z.boolean(),
  }),
  totals: z.object({
    learnedWords: z.number().int().nonnegative(),
    masteredWords: z.number().int().nonnegative(),
    reviewLogs: z.number().int().nonnegative(),
    checkins: z.number().int().nonnegative(),
  }),
  progress: z.object({
    activeBookName: z.string().min(1).nullable(),
    totalWords: z.number().int().nonnegative(),
    learnedWords: z.number().int().nonnegative(),
    masteredWords: z.number().int().nonnegative(),
    dueReviews: z.number().int().nonnegative(),
  }),
  streak: z.object({
    current: z.number().int().nonnegative(),
    recentDays: z.array(recentCheckinDaySchema),
  }),
  generatedAt: z.string().datetime(),
})

export const dashboardTrendDaySchema = z.object({
  dateKey: dateKeySchema,
  completedSessions: z.number().int().nonnegative(),
  reviewLogs: z.number().int().nonnegative(),
  checkedIn: z.boolean(),
})

export const dashboardTrendsResponseSchema = z.object({
  days: z.array(dashboardTrendDaySchema),
})

export type DashboardSummaryResponse = z.infer<
  typeof dashboardSummaryResponseSchema
>
export type DashboardTrendDay = z.infer<typeof dashboardTrendDaySchema>
export type DashboardTrendsResponse = z.infer<
  typeof dashboardTrendsResponseSchema
>
