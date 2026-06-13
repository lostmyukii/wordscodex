import { describe, expect, it } from 'vitest'

import { sortDueReviewCandidates } from './review-queue.js'

describe('sortDueReviewCandidates', () => {
  it('orders due review candidates by mastery priority', () => {
    const sorted = sortDueReviewCandidates([
      candidate('word-mastered', 'mastered', '2026-06-13T00:00:00.000Z'),
      candidate('word-learning', 'learning', '2026-06-13T00:00:00.000Z'),
      candidate('word-mistake', 'mistake', '2026-06-13T00:00:00.000Z'),
      candidate('word-fuzzy', 'fuzzy', '2026-06-13T00:00:00.000Z'),
      candidate('word-lapsed', 'lapsed', '2026-06-13T00:00:00.000Z'),
    ])

    expect(sorted.map((item) => item.wordId)).toEqual([
      'word-mistake',
      'word-lapsed',
      'word-fuzzy',
      'word-learning',
      'word-mastered',
    ])
  })

  it('uses due time, update time, and word id as deterministic tie breakers', () => {
    const sorted = sortDueReviewCandidates([
      candidate(
        'word-c',
        'learning',
        '2026-06-13T02:00:00.000Z',
        '2026-06-12T09:00:00.000Z',
      ),
      candidate(
        'word-b',
        'learning',
        '2026-06-13T01:00:00.000Z',
        '2026-06-12T10:00:00.000Z',
      ),
      candidate(
        'word-d',
        'learning',
        '2026-06-13T01:00:00.000Z',
        '2026-06-12T08:00:00.000Z',
      ),
      candidate(
        'word-a',
        'learning',
        '2026-06-13T01:00:00.000Z',
        '2026-06-12T08:00:00.000Z',
      ),
    ])

    expect(sorted.map((item) => item.wordId)).toEqual([
      'word-a',
      'word-d',
      'word-b',
      'word-c',
    ])
  })
})

function candidate(
  wordId: string,
  masteryState:
    | 'new'
    | 'learning'
    | 'fuzzy'
    | 'mastered'
    | 'mistake'
    | 'lapsed',
  nextReviewAt: string | null,
  updatedAt = '2026-06-12T00:00:00.000Z',
) {
  return {
    wordId,
    masteryState,
    nextReviewAt,
    updatedAt,
  }
}
