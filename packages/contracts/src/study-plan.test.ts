import { describe, expect, it } from 'vitest'
import {
  activeStudyPlanResponseSchema,
  createStudyPlanRequestSchema,
  errorResponseSchema,
  studyPlanResponseSchema,
  studyPlanSchema,
} from './index.js'

const plan = {
  id: 'plan_123',
  userId: 'user_123',
  vocabularyBookId: 'book_cet4',
  learningGoal: 'college',
  dailyNewWordTarget: 50,
  dailyReviewLimit: 80,
  targetDate: '2026-08-03T00:00:00.000Z',
  reminderEnabled: true,
  status: 'active',
  startedAt: '2026-06-13T00:00:00.000Z',
  createdAt: '2026-06-13T00:00:00.000Z',
  updatedAt: '2026-06-13T00:00:00.000Z',
}

describe('study plan contracts', () => {
  it('accepts a valid study plan payload', () => {
    expect(studyPlanSchema.parse(plan)).toEqual(plan)
    expect(studyPlanResponseSchema.parse({ plan })).toEqual({ plan })
    expect(activeStudyPlanResponseSchema.parse({ plan })).toEqual({ plan })
    expect(activeStudyPlanResponseSchema.parse({ plan: null })).toEqual({
      plan: null,
    })
  })

  it('normalizes create requests with defaults', () => {
    expect(
      createStudyPlanRequestSchema.parse({
        vocabularyBookId: ' cet4-core ',
        learningGoal: 'college',
        dailyNewWordTarget: 50,
        reminderEnabled: true,
      }),
    ).toEqual({
      vocabularyBookId: 'cet4-core',
      learningGoal: 'college',
      dailyNewWordTarget: 50,
      dailyReviewLimit: 80,
      targetDate: null,
      reminderEnabled: true,
    })
  })

  it('rejects invalid targets and unknown goals', () => {
    expect(() =>
      createStudyPlanRequestSchema.parse({
        vocabularyBookId: 'cet4-core',
        learningGoal: 'gaming',
        dailyNewWordTarget: 50,
      }),
    ).toThrow()

    expect(() =>
      createStudyPlanRequestSchema.parse({
        vocabularyBookId: 'cet4-core',
        learningGoal: 'college',
        dailyNewWordTarget: 0,
      }),
    ).toThrow()
  })

  it('allows an active plan conflict error code', () => {
    expect(
      errorResponseSchema.parse({
        error: {
          code: 'ACTIVE_STUDY_PLAN_EXISTS',
          message: '已经有进行中的学习计划。',
          requestId: 'req_123',
        },
      }),
    ).toEqual({
      error: {
        code: 'ACTIVE_STUDY_PLAN_EXISTS',
        message: '已经有进行中的学习计划。',
        requestId: 'req_123',
      },
    })
  })
})
