import type {
  AnalyticsEventName,
  AnalyticsProperties,
  AnalyticsSummaryResponse,
  CreateAnalyticsEventRequest,
} from '@wordscodex/contracts'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import type { AnalyticsRepository } from './analytics-routes.js'

export class PrismaAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async recordEvent(
    input: CreateAnalyticsEventRequest & {
      userId: string | null
    },
  ) {
    const existing = await this.prisma.analyticsEvent.findUnique({
      where: {
        clientEventId: input.clientEventId,
      },
    })
    if (existing) {
      return {
        accepted: true as const,
        eventId: existing.id,
        alreadyProcessed: true,
      }
    }

    const event = await this.prisma.analyticsEvent.create({
      data: {
        clientEventId: input.clientEventId,
        userId: input.userId,
        name: input.name,
        properties: input.properties satisfies AnalyticsProperties,
        occurredAt: new Date(input.occurredAt),
      },
    })

    return {
      accepted: true as const,
      eventId: event.id,
      alreadyProcessed: false,
    }
  }

  async getSummary(input: { days: number; now: Date }) {
    const since = new Date(input.now.getTime() - input.days * 24 * 60 * 60_000)
    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        occurredAt: {
          gte: since,
        },
      },
      select: {
        name: true,
        userId: true,
      },
    })
    const grouped = new Map<AnalyticsEventName, number>()
    const userIds = new Set<string>()
    let anonymousEvents = 0

    for (const event of events) {
      const name = event.name as AnalyticsEventName
      grouped.set(name, (grouped.get(name) ?? 0) + 1)
      if (event.userId) {
        userIds.add(event.userId)
      } else {
        anonymousEvents += 1
      }
    }

    return {
      days: input.days,
      totalEvents: events.length,
      uniqueUsers: userIds.size,
      anonymousEvents,
      events: [...grouped.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    } satisfies AnalyticsSummaryResponse
  }
}
