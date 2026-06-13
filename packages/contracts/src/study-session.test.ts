import { describe, expect, it } from 'vitest'
import { errorResponseSchema } from './auth.js'
import {
  createStudySessionRequestSchema,
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
  })
})
