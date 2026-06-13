import { z } from 'zod'

export const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const checkinSchema = z.object({
  id: z.string().min(1),
  dateKey: dateKeySchema,
  checkedInAt: z.string().datetime(),
  completedSessions: z.number().int().nonnegative(),
})

export const recentCheckinDaySchema = z.object({
  dateKey: dateKeySchema,
  checkedIn: z.boolean(),
})

export const checkinSummarySchema = z.object({
  todayKey: dateKeySchema,
  checkedInToday: z.boolean(),
  currentStreak: z.number().int().nonnegative(),
  recentDays: z.array(recentCheckinDaySchema),
})

export const checkinListResponseSchema = z.object({
  summary: checkinSummarySchema,
  items: z.array(checkinSchema),
})

export const createCheckinResponseSchema = z.object({
  checkin: checkinSchema,
  summary: checkinSummarySchema,
  alreadyCheckedIn: z.boolean(),
})

export type DateKey = z.infer<typeof dateKeySchema>
export type Checkin = z.infer<typeof checkinSchema>
export type RecentCheckinDay = z.infer<typeof recentCheckinDaySchema>
export type CheckinSummary = z.infer<typeof checkinSummarySchema>
export type CheckinListResponse = z.infer<typeof checkinListResponseSchema>
export type CreateCheckinResponse = z.infer<typeof createCheckinResponseSchema>
