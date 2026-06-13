import { describe, expect, it } from 'vitest'
import {
  dashboardSummaryResponseSchema,
  dashboardTrendsResponseSchema,
} from './dashboard.js'

const fixedIso = '2026-06-13T08:00:00.000Z'

describe('dashboard contracts', () => {
  it('parses the dashboard summary response', () => {
    const response = dashboardSummaryResponseSchema.parse({
      plan: null,
      today: {
        dateKey: '2026-06-13',
        completedSessions: 1,
        canCheckIn: true,
        checkedInToday: true,
      },
      totals: {
        learnedWords: 12,
        masteredWords: 3,
        reviewLogs: 20,
        checkins: 4,
      },
      progress: {
        activeBookName: null,
        totalWords: 0,
        learnedWords: 12,
        masteredWords: 3,
        dueReviews: 5,
      },
      streak: {
        current: 4,
        recentDays: [{ dateKey: '2026-06-13', checkedIn: true }],
      },
      generatedAt: fixedIso,
    })

    expect(response.streak.current).toBe(4)
  })

  it('parses dashboard trends', () => {
    const response = dashboardTrendsResponseSchema.parse({
      days: [
        {
          dateKey: '2026-06-13',
          completedSessions: 1,
          reviewLogs: 10,
          checkedIn: true,
        },
      ],
    })

    expect(response.days[0]?.checkedIn).toBe(true)
  })
})
