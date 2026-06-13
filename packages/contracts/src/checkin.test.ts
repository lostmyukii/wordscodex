import { describe, expect, it } from 'vitest'
import {
  checkinListResponseSchema,
  createCheckinResponseSchema,
} from './checkin.js'

const fixedIso = '2026-06-13T08:00:00.000Z'

describe('checkin contracts', () => {
  it('parses a checkin list response', () => {
    const response = checkinListResponseSchema.parse({
      summary: {
        todayKey: '2026-06-13',
        checkedInToday: true,
        currentStreak: 2,
        recentDays: [
          { dateKey: '2026-06-12', checkedIn: true },
          { dateKey: '2026-06-13', checkedIn: true },
        ],
      },
      items: [
        {
          id: 'checkin_123',
          dateKey: '2026-06-13',
          checkedInAt: fixedIso,
          completedSessions: 1,
        },
      ],
    })

    expect(response.summary.currentStreak).toBe(2)
    expect(response.items[0]?.dateKey).toBe('2026-06-13')
  })

  it('parses an idempotent create checkin response', () => {
    const response = createCheckinResponseSchema.parse({
      checkin: {
        id: 'checkin_123',
        dateKey: '2026-06-13',
        checkedInAt: fixedIso,
        completedSessions: 1,
      },
      summary: {
        todayKey: '2026-06-13',
        checkedInToday: true,
        currentStreak: 1,
        recentDays: [{ dateKey: '2026-06-13', checkedIn: true }],
      },
      alreadyCheckedIn: true,
    })

    expect(response.alreadyCheckedIn).toBe(true)
  })
})
