import { describe, expect, it } from 'vitest'
import { errorResponseSchema } from './auth.js'
import {
  createMistakeDrillSessionRequestSchema,
  mistakeListResponseSchema,
} from './mistakes.js'

const fixedIso = '2026-06-13T00:00:00.000Z'

const plan = {
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
}

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

describe('mistakes contracts', () => {
  it('accepts a mistake list response scoped to the active plan', () => {
    const response = mistakeListResponseSchema.parse({
      plan,
      summary: {
        total: 1,
        dueNow: 1,
      },
      items: [
        {
          word,
          masteryState: 'mistake',
          repetitions: 1,
          correctCount: 0,
          incorrectCount: 1,
          lastReviewedAt: fixedIso,
          nextReviewAt: '2026-06-13T00:10:00.000Z',
          lastErrorType: 'word_to_meaning',
          updatedAt: fixedIso,
        },
      ],
    })

    expect(response.items[0]).toMatchObject({
      masteryState: 'mistake',
      incorrectCount: 1,
      word: {
        lemma: 'ability',
      },
    })
  })

  it('rejects non-mistake mastery states in the mistake list', () => {
    expect(() =>
      mistakeListResponseSchema.parse({
        plan,
        summary: {
          total: 1,
          dueNow: 0,
        },
        items: [
          {
            word,
            masteryState: 'learning',
            repetitions: 1,
            correctCount: 1,
            incorrectCount: 0,
            lastReviewedAt: fixedIso,
            nextReviewAt: '2026-06-15T00:00:00.000Z',
            lastErrorType: null,
            updatedAt: fixedIso,
          },
        ],
      }),
    ).toThrow()
  })

  it('defaults a mistake drill session request to twenty words', () => {
    expect(createMistakeDrillSessionRequestSchema.parse({})).toEqual({
      limit: 20,
    })
  })

  it('accepts the empty mistake drill error code', () => {
    expect(
      errorResponseSchema.parse({
        error: {
          code: 'EMPTY_MISTAKE_SESSION',
          message: '暂无需要强化的错词。',
          requestId: 'req_123',
        },
      }).error.code,
    ).toBe('EMPTY_MISTAKE_SESSION')
  })
})
