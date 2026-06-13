import { describe, expect, it } from 'vitest'
import { calculateSrsReview } from './schedule.js'

const reviewedAt = new Date('2026-06-13T00:00:00.000Z')

describe('calculateSrsReview', () => {
  it('schedules a new word from each initial rating', () => {
    expect(
      calculateSrsReview({
        previous: null,
        rating: 'again',
        isCorrect: false,
        responseMs: 12_000,
        questionType: 'word_to_meaning',
        reviewedAt,
      }),
    ).toMatchObject({
      masteryState: 'mistake',
      repetitions: 1,
      consecutiveCorrect: 0,
      correctCount: 0,
      incorrectCount: 1,
      easeFactor: 2.1,
      intervalDays: 0,
      nextReviewAt: '2026-06-13T00:10:00.000Z',
      lastErrorType: 'word_to_meaning',
    })

    expect(
      calculateSrsReview({
        previous: null,
        rating: 'hard',
        isCorrect: true,
        responseMs: 8_500,
        questionType: 'word_to_meaning',
        reviewedAt,
      }),
    ).toMatchObject({
      masteryState: 'fuzzy',
      consecutiveCorrect: 1,
      correctCount: 1,
      incorrectCount: 0,
      easeFactor: 2.2,
      intervalDays: 1,
      nextReviewAt: '2026-06-14T00:00:00.000Z',
    })

    expect(
      calculateSrsReview({
        previous: null,
        rating: 'good',
        isCorrect: true,
        responseMs: 4_200,
        questionType: 'word_to_meaning',
        reviewedAt,
      }),
    ).toMatchObject({
      masteryState: 'learning',
      intervalDays: 2,
      nextReviewAt: '2026-06-15T00:00:00.000Z',
    })

    expect(
      calculateSrsReview({
        previous: null,
        rating: 'easy',
        isCorrect: true,
        responseMs: 2_000,
        questionType: 'word_to_meaning',
        reviewedAt,
      }),
    ).toMatchObject({
      masteryState: 'learning',
      easeFactor: 2.4,
      intervalDays: 4,
      nextReviewAt: '2026-06-17T00:00:00.000Z',
    })
  })

  it('uses subsequent intervals and clamps ease factor', () => {
    const progress = calculateSrsReview({
      previous: {
        masteryState: 'learning',
        repetitions: 4,
        consecutiveCorrect: 2,
        correctCount: 4,
        incorrectCount: 0,
        easeFactor: 3,
        intervalDays: 10,
        lastReviewedAt: '2026-06-03T00:00:00.000Z',
        nextReviewAt: reviewedAt.toISOString(),
        averageResponseMs: 5_000,
        lastErrorType: null,
      },
      rating: 'easy',
      isCorrect: true,
      responseMs: 1_000,
      questionType: 'word_to_meaning',
      reviewedAt,
    })

    expect(progress).toMatchObject({
      masteryState: 'mastered',
      repetitions: 5,
      consecutiveCorrect: 3,
      correctCount: 5,
      incorrectCount: 0,
      easeFactor: 3,
      intervalDays: 39,
      nextReviewAt: '2026-07-22T00:00:00.000Z',
      averageResponseMs: 4200,
    })
  })

  it('turns a mastered word into lapsed when answered incorrectly', () => {
    const progress = calculateSrsReview({
      previous: {
        masteryState: 'mastered',
        repetitions: 8,
        consecutiveCorrect: 6,
        correctCount: 8,
        incorrectCount: 0,
        easeFactor: 1.35,
        intervalDays: 21,
        lastReviewedAt: '2026-05-23T00:00:00.000Z',
        nextReviewAt: reviewedAt.toISOString(),
        averageResponseMs: 3_000,
        lastErrorType: null,
      },
      rating: 'again',
      isCorrect: false,
      responseMs: 9_000,
      questionType: 'spelling',
      reviewedAt,
    })

    expect(progress).toMatchObject({
      masteryState: 'lapsed',
      consecutiveCorrect: 0,
      incorrectCount: 1,
      easeFactor: 1.3,
      intervalDays: 0,
      nextReviewAt: '2026-06-13T00:10:00.000Z',
      lastErrorType: 'spelling',
    })
  })
})
