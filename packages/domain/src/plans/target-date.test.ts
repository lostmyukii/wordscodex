import { describe, expect, it } from 'vitest'
import { calculatePlanTargetDate } from './target-date.js'

describe('calculatePlanTargetDate', () => {
  it('estimates the completion date from vocabulary size and daily new words', () => {
    expect(
      calculatePlanTargetDate({
        startDate: new Date('2026-06-13T10:30:00.000Z'),
        wordCount: 2600,
        dailyNewWordTarget: 50,
      }).toISOString(),
    ).toBe('2026-08-03T00:00:00.000Z')
  })

  it('keeps the start date when the vocabulary has no words yet', () => {
    expect(
      calculatePlanTargetDate({
        startDate: new Date('2026-06-13T10:30:00.000Z'),
        wordCount: 0,
        dailyNewWordTarget: 50,
      }).toISOString(),
    ).toBe('2026-06-13T00:00:00.000Z')
  })

  it('rejects non-positive daily new word targets', () => {
    expect(() =>
      calculatePlanTargetDate({
        startDate: new Date('2026-06-13T10:30:00.000Z'),
        wordCount: 2600,
        dailyNewWordTarget: 0,
      }),
    ).toThrow('dailyNewWordTarget must be greater than 0')
  })
})
