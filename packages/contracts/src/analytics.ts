import { z } from 'zod'

const analyticsPropertyValueSchema = z.union([
  z.string().max(200),
  z.number().finite(),
  z.boolean(),
  z.null(),
])

const privateAnalyticsPropertyKeys = new Set([
  'answer',
  'answerText',
  'email',
  'phone',
  'token',
  'accessToken',
  'refreshToken',
  'verificationCode',
])

export const analyticsEventNameSchema = z.enum([
  'auth_completed',
  'onboarding_started',
  'onboarding_completed',
  'book_selected',
  'plan_created',
  'study_session_started',
  'review_answered',
  'study_session_completed',
  'mistake_drill_started',
  'mistake_removed',
  'checkin_completed',
  'pwa_install_prompt_shown',
  'pwa_installed',
  'pwa_update_ready',
  'pwa_update_applied',
  'offline_queue_created',
  'offline_queue_synced',
])

export const analyticsPropertiesSchema = z
  .record(z.string().min(1).max(60), analyticsPropertyValueSchema)
  .default({})
  .superRefine((properties, context) => {
    for (const key of Object.keys(properties)) {
      if (privateAnalyticsPropertyKeys.has(key)) {
        context.addIssue({
          code: 'custom',
          message: `Analytics property "${key}" is not allowed.`,
          path: [key],
        })
      }
    }
  })

export const createAnalyticsEventRequestSchema = z.object({
  clientEventId: z.string().min(1).max(120),
  name: analyticsEventNameSchema,
  occurredAt: z.string().datetime(),
  properties: analyticsPropertiesSchema,
})

export const createAnalyticsEventResponseSchema = z.object({
  accepted: z.literal(true),
  eventId: z.string().min(1),
  alreadyProcessed: z.boolean(),
})

export const analyticsSummaryQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
})

export const analyticsSummaryEventSchema = z.object({
  name: analyticsEventNameSchema,
  count: z.number().int().nonnegative(),
})

export const analyticsSummaryResponseSchema = z.object({
  days: z.number().int().min(1).max(90),
  totalEvents: z.number().int().nonnegative(),
  uniqueUsers: z.number().int().nonnegative(),
  anonymousEvents: z.number().int().nonnegative(),
  events: z.array(analyticsSummaryEventSchema),
})

export type AnalyticsEventName = z.infer<typeof analyticsEventNameSchema>
export type AnalyticsProperties = z.infer<typeof analyticsPropertiesSchema>
export type CreateAnalyticsEventRequest = z.infer<
  typeof createAnalyticsEventRequestSchema
>
export type CreateAnalyticsEventResponse = z.infer<
  typeof createAnalyticsEventResponseSchema
>
export type AnalyticsSummaryQuery = z.infer<typeof analyticsSummaryQuerySchema>
export type AnalyticsSummaryEvent = z.infer<typeof analyticsSummaryEventSchema>
export type AnalyticsSummaryResponse = z.infer<
  typeof analyticsSummaryResponseSchema
>
