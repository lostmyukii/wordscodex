import { describe, expect, it } from 'vitest'
import { errorResponseSchema } from './auth.js'
import {
  createStudySessionRequestSchema,
  reviewProgressSchema,
  submitReviewRequestSchema,
  submitReviewResponseSchema,
  studySessionResponseSchema,
  todayResponseSchema,
  wordSchema,
} from './study-session.js'

const fixedIso = '2026-06-13T00:00:00.000Z'

const word = {
  id: 'word_ability',
  lemma: 'ability',
  phoneticUk: '/əˈbɪləti/',
  phoneticUs: '/əˈbɪləti/',
  audioUkUrl: null,
  audioUsUrl: null,
  imageUrl: null,
  meanings: [
    {
      partOfSpeech: 'n.',
      definitionZh: '能力；才能',
      definitionEn: 'the power or skill to do something',
    },
  ],
  examples: [
    {
      sentence: 'Reading improves your ability to learn.',
      translationZh: '阅读会提升你的学习能力。',
      source: 'seed',
    },
  ],
}

describe('study session contracts', () => {
  it('accepts a word with meanings and examples', () => {
    expect(wordSchema.parse(word)).toEqual(word)
  })

  it('accepts a today response with prioritized tasks and a recommendation', () => {
    expect(
      todayResponseSchema.parse({
        plan: {
          id: 'plan_123',
          userId: 'user_123',
          vocabularyBookId: 'book_cet4',
          learningGoal: 'college',
          dailyNewWordTarget: 50,
          dailyReviewLimit: 80,
          targetDate: null,
          reminderEnabled: true,
          status: 'active',
          startedAt: fixedIso,
          createdAt: fixedIso,
          updatedAt: fixedIso,
        },
        summary: {
          date: '2026-06-13',
          newWordsDue: 3,
          reviewsDue: 0,
          completedSessions: 0,
          canCheckIn: false,
        },
        tasks: [
          {
            type: 'new_words',
            title: '今日新词',
            count: 3,
            description: '学习计划安排的新词任务。',
          },
        ],
        nextSessionRecommendation: {
          mode: 'new_words',
          newWordLimit: 3,
          reviewLimit: 0,
        },
      }),
    ).toMatchObject({
      summary: {
        newWordsDue: 3,
      },
      nextSessionRecommendation: {
        mode: 'new_words',
      },
    })
  })

  it('defaults a create session request to a small mixed session', () => {
    expect(createStudySessionRequestSchema.parse({})).toEqual({
      mode: 'mixed',
      newWordLimit: 10,
      reviewLimit: 30,
    })
  })

  it('accepts a persisted study session response', () => {
    const body = studySessionResponseSchema.parse({
      session: {
        id: 'session_123',
        userId: 'user_123',
        mode: 'new_words',
        status: 'active',
        startedAt: fixedIso,
        completedAt: null,
        items: [
          {
            id: 'item_1',
            position: 1,
            questionType: 'word_to_meaning',
            word,
          },
        ],
      },
    })

    expect(body.session.items[0]?.word.lemma).toBe('ability')
  })

  it('accepts a submit review request and normalized progress response', () => {
    expect(
      submitReviewRequestSchema.parse({
        wordId: 'word_ability',
        questionType: 'word_to_meaning',
        rating: 'good',
        isCorrect: true,
        responseMs: 4200,
        answer: '能力；才能',
        reviewedAt: fixedIso,
      }),
    ).toMatchObject({
      rating: 'good',
      responseMs: 4200,
    })

    const progress = reviewProgressSchema.parse({
      masteryState: 'learning',
      repetitions: 1,
      consecutiveCorrect: 1,
      correctCount: 1,
      incorrectCount: 0,
      easeFactor: 2.3,
      intervalDays: 2,
      lastReviewedAt: fixedIso,
      nextReviewAt: '2026-06-15T00:00:00.000Z',
      averageResponseMs: 4200,
      lastErrorType: null,
    })

    expect(
      submitReviewResponseSchema.parse({
        progress,
        alreadyProcessed: false,
      }),
    ).toEqual({
      progress,
      alreadyProcessed: false,
    })
  })

  it('accepts stable study session error codes', () => {
    expect(
      errorResponseSchema.parse({
        error: {
          code: 'NO_ACTIVE_STUDY_PLAN',
          message: '还没有进行中的学习计划。',
          requestId: 'req_123',
        },
      }).error.code,
    ).toBe('NO_ACTIVE_STUDY_PLAN')

    expect(
      errorResponseSchema.parse({
        error: {
          code: 'EMPTY_STUDY_SESSION',
          message: '今日暂无可学习的新词。',
          requestId: 'req_123',
        },
      }).error.code,
    ).toBe('EMPTY_STUDY_SESSION')

    expect(
      errorResponseSchema.parse({
        error: {
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          message: '学习记录缺少幂等键，请重试。',
          requestId: 'req_123',
        },
      }).error.code,
    ).toBe('IDEMPOTENCY_KEY_REQUIRED')
  })
})
