import type {
  Checkin,
  CheckinSummary,
  DashboardSummaryResponse,
  DashboardTrendsResponse,
  StudyPlan,
} from '@wordscodex/contracts'
import {
  buildRecentCheckinDays,
  calculateCurrentStreak,
} from '@wordscodex/domain'
import type { PrismaClient } from '../../../generated/prisma/client.js'
import { CheckinNotAllowedError } from './engagement-routes.js'

type CheckinRecord = {
  id: string
  dateKey: string
  checkedInAt: Date
  completedSessions: number
}

type StudyPlanRecord = {
  id: string
  userId: string
  vocabularyBookId: string
  learningGoal: 'k12' | 'college' | 'postgraduate' | 'overseas' | 'workplace'
  dailyNewWordTarget: number
  dailyReviewLimit: number
  targetDate: Date | null
  reminderEnabled: boolean
  status: 'active' | 'paused' | 'completed'
  startedAt: Date
  createdAt: Date
  updatedAt: Date
}

type ActivePlanRecord = StudyPlanRecord & {
  vocabularyBook: {
    name: string
    wordCount: number
  }
}

export class PrismaEngagementRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listCheckins(input: { userId: string; timezone: string; now: Date }) {
    const todayKey = toDateKey(input.now, input.timezone)
    const checkins = await this.findUserCheckins(input.userId)

    return {
      summary: buildSummary({
        todayKey,
        checkins,
      }),
      items: checkins.slice(0, 30).map(toCheckin),
    }
  }

  async createCheckin(input: { userId: string; timezone: string; now: Date }) {
    const todayKey = toDateKey(input.now, input.timezone)
    const existing = await this.prisma.checkin.findUnique({
      where: {
        userId_dateKey: {
          userId: input.userId,
          dateKey: todayKey,
        },
      },
    })

    if (existing) {
      const checkins = await this.findUserCheckins(input.userId)

      return {
        checkin: toCheckin(existing),
        summary: buildSummary({
          todayKey,
          checkins,
        }),
        alreadyCheckedIn: true,
      }
    }

    const completedSessions = await this.countCompletedSessionsOnDate({
      userId: input.userId,
      dateKey: todayKey,
      timezone: input.timezone,
    })
    if (completedSessions === 0) {
      throw new CheckinNotAllowedError()
    }

    const checkin = await this.prisma.checkin.create({
      data: {
        userId: input.userId,
        dateKey: todayKey,
        checkedInAt: input.now,
        completedSessions,
      },
    })
    const checkins = await this.findUserCheckins(input.userId)

    return {
      checkin: toCheckin(checkin),
      summary: buildSummary({
        todayKey,
        checkins,
      }),
      alreadyCheckedIn: false,
    }
  }

  async getDashboardSummary(input: {
    userId: string
    timezone: string
    now: Date
  }): Promise<DashboardSummaryResponse> {
    const todayKey = toDateKey(input.now, input.timezone)
    const activePlan = await this.findActivePlan(input.userId)
    const [
      checkins,
      completedSessions,
      learnedWords,
      masteredWords,
      reviewLogs,
      checkinCount,
      activeBookLearnedWords,
      activeBookMasteredWords,
      dueReviews,
    ] = await Promise.all([
      this.findUserCheckins(input.userId),
      this.countCompletedSessionsOnDate({
        userId: input.userId,
        dateKey: todayKey,
        timezone: input.timezone,
      }),
      this.prisma.userWordProgress.count({
        where: {
          userId: input.userId,
        },
      }),
      this.prisma.userWordProgress.count({
        where: {
          userId: input.userId,
          masteryState: 'mastered',
        },
      }),
      this.prisma.reviewLog.count({
        where: {
          userId: input.userId,
        },
      }),
      this.prisma.checkin.count({
        where: {
          userId: input.userId,
        },
      }),
      activePlan
        ? this.countProgressInBook(input.userId, activePlan.vocabularyBookId)
        : Promise.resolve(0),
      activePlan
        ? this.countProgressInBook(
            input.userId,
            activePlan.vocabularyBookId,
            'mastered',
          )
        : Promise.resolve(0),
      activePlan
        ? this.prisma.userWordProgress.count({
            where: {
              userId: input.userId,
              nextReviewAt: {
                lte: input.now,
              },
              word: {
                vocabularyBookId: activePlan.vocabularyBookId,
              },
            },
          })
        : Promise.resolve(0),
    ])
    const summary = buildSummary({
      todayKey,
      checkins,
    })

    return {
      plan: activePlan ? toStudyPlan(activePlan) : null,
      today: {
        dateKey: todayKey,
        completedSessions,
        canCheckIn: completedSessions > 0,
        checkedInToday: summary.checkedInToday,
      },
      totals: {
        learnedWords,
        masteredWords,
        reviewLogs,
        checkins: checkinCount,
      },
      progress: {
        activeBookName: activePlan?.vocabularyBook.name ?? null,
        totalWords: activePlan?.vocabularyBook.wordCount ?? 0,
        learnedWords: activePlan ? activeBookLearnedWords : learnedWords,
        masteredWords: activePlan ? activeBookMasteredWords : masteredWords,
        dueReviews,
      },
      streak: {
        current: summary.currentStreak,
        recentDays: summary.recentDays,
      },
      generatedAt: input.now.toISOString(),
    }
  }

  async getDashboardTrends(input: {
    userId: string
    timezone: string
    now: Date
    days: number
  }): Promise<DashboardTrendsResponse> {
    const todayKey = toDateKey(input.now, input.timezone)
    const [checkins, sessions, reviewLogs] = await Promise.all([
      this.findUserCheckins(input.userId),
      this.prisma.studySession.findMany({
        where: {
          userId: input.userId,
          status: 'completed',
          completedAt: {
            not: null,
          },
        },
        select: {
          completedAt: true,
        },
      }),
      this.prisma.reviewLog.findMany({
        where: {
          userId: input.userId,
        },
        select: {
          reviewedAt: true,
        },
      }),
    ])
    const completedSessionsByDate = countDates(
      sessions.flatMap((session) =>
        session.completedAt ? [session.completedAt] : [],
      ),
      input.timezone,
    )
    const reviewLogsByDate = countDates(
      reviewLogs.map((reviewLog) => reviewLog.reviewedAt),
      input.timezone,
    )

    return {
      days: buildRecentCheckinDays({
        todayKey,
        days: input.days,
        checkins,
      }).map((day) => ({
        dateKey: day.dateKey,
        checkedIn: day.checkedIn,
        completedSessions: completedSessionsByDate.get(day.dateKey) ?? 0,
        reviewLogs: reviewLogsByDate.get(day.dateKey) ?? 0,
      })),
    }
  }

  private findUserCheckins(userId: string): Promise<CheckinRecord[]> {
    return this.prisma.checkin.findMany({
      where: {
        userId,
      },
      orderBy: {
        dateKey: 'desc',
      },
    })
  }

  private async countCompletedSessionsOnDate(input: {
    userId: string
    dateKey: string
    timezone: string
  }) {
    const sessions = await this.prisma.studySession.findMany({
      where: {
        userId: input.userId,
        status: 'completed',
        completedAt: {
          not: null,
        },
      },
      select: {
        completedAt: true,
      },
    })

    return sessions.filter(
      (session) =>
        session.completedAt &&
        toDateKey(session.completedAt, input.timezone) === input.dateKey,
    ).length
  }

  private countProgressInBook(
    userId: string,
    vocabularyBookId: string,
    masteryState?: 'mastered',
  ) {
    return this.prisma.userWordProgress.count({
      where: {
        userId,
        ...(masteryState ? { masteryState } : {}),
        word: {
          vocabularyBookId,
        },
      },
    })
  }

  private findActivePlan(userId: string): Promise<ActivePlanRecord | null> {
    return this.prisma.studyPlan.findFirst({
      where: {
        userId,
        status: 'active',
      },
      include: {
        vocabularyBook: {
          select: {
            name: true,
            wordCount: true,
          },
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
    })
  }
}

function buildSummary(input: {
  todayKey: string
  checkins: CheckinRecord[]
}): CheckinSummary {
  return {
    todayKey: input.todayKey,
    checkedInToday: input.checkins.some(
      (checkin) => checkin.dateKey === input.todayKey,
    ),
    currentStreak: calculateCurrentStreak({
      todayKey: input.todayKey,
      checkins: input.checkins,
    }),
    recentDays: buildRecentCheckinDays({
      todayKey: input.todayKey,
      days: 7,
      checkins: input.checkins,
    }),
  }
}

function toCheckin(record: CheckinRecord): Checkin {
  return {
    id: record.id,
    dateKey: record.dateKey,
    checkedInAt: record.checkedInAt.toISOString(),
    completedSessions: record.completedSessions,
  }
}

function toStudyPlan(record: StudyPlanRecord): StudyPlan {
  return {
    ...record,
    targetDate: record.targetDate?.toISOString() ?? null,
    startedAt: record.startedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

function countDates(dates: Date[], timezone: string) {
  const counts = new Map<string, number>()

  for (const date of dates) {
    const dateKey = toDateKey(date, timezone)
    counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1)
  }

  return counts
}

function toDateKey(date: Date, timezone: string) {
  const formatter = createDateKeyFormatter(timezone)
  const parts = formatter.formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value

  if (!year || !month || !day) return date.toISOString().slice(0, 10)

  return `${year}-${month}-${day}`
}

function createDateKeyFormatter(timezone: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }
}
