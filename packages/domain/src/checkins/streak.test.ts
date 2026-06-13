import { describe, expect, it } from 'vitest'
import { buildRecentCheckinDays, calculateCurrentStreak } from './streak.js'

describe('checkin streaks', () => {
  it('counts consecutive days ending today', () => {
    expect(
      calculateCurrentStreak({
        todayKey: '2026-06-13',
        checkins: [
          { dateKey: '2026-06-11' },
          { dateKey: '2026-06-12' },
          { dateKey: '2026-06-13' },
        ],
      }),
    ).toBe(3)
  })

  it('stops counting at the first missing day', () => {
    expect(
      calculateCurrentStreak({
        todayKey: '2026-06-13',
        checkins: [
          { dateKey: '2026-06-10' },
          { dateKey: '2026-06-11' },
          { dateKey: '2026-06-13' },
        ],
      }),
    ).toBe(1)
  })

  it('ignores duplicate dates when calculating the streak', () => {
    expect(
      calculateCurrentStreak({
        todayKey: '2026-06-13',
        checkins: [
          { dateKey: '2026-06-12' },
          { dateKey: '2026-06-12' },
          { dateKey: '2026-06-13' },
        ],
      }),
    ).toBe(2)
  })

  it('builds a recent day window from oldest to newest', () => {
    expect(
      buildRecentCheckinDays({
        todayKey: '2026-06-13',
        days: 4,
        checkins: [{ dateKey: '2026-06-11' }, { dateKey: '2026-06-13' }],
      }),
    ).toEqual([
      { dateKey: '2026-06-10', checkedIn: false },
      { dateKey: '2026-06-11', checkedIn: true },
      { dateKey: '2026-06-12', checkedIn: false },
      { dateKey: '2026-06-13', checkedIn: true },
    ])
  })
})
