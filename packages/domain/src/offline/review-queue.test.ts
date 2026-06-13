import { describe, expect, it } from 'vitest'
import {
  isOfflineReviewOperationReady,
  markOfflineReviewOperationFailed,
  selectPendingOfflineReviewOperations,
  upsertOfflineReviewOperation,
  type OfflineReviewOperation,
} from './review-queue.js'

const baseOperation: OfflineReviewOperation = {
  idempotencyKey: 'idem_1',
  sessionId: 'session_123',
  wordId: 'word_ability',
  createdAt: '2026-06-13T08:00:00.000Z',
  retryCount: 0,
  lastError: null,
  lastAttemptAt: null,
}

describe('offline review queue rules', () => {
  it('dedupes operations by idempotency key without changing the original created time', () => {
    const result = upsertOfflineReviewOperation({
      queue: [baseOperation],
      operation: {
        ...baseOperation,
        createdAt: '2026-06-13T08:05:00.000Z',
        lastError: 'network failed',
      },
    })

    expect(result).toEqual([
      {
        ...baseOperation,
        lastError: 'network failed',
      },
    ])
  })

  it('selects pending operations by created time', () => {
    const later = {
      ...baseOperation,
      idempotencyKey: 'idem_2',
      wordId: 'word_absorb',
      createdAt: '2026-06-13T08:05:00.000Z',
    }
    const selected = selectPendingOfflineReviewOperations({
      queue: [later, baseOperation],
      limit: 1,
    })

    expect(selected).toEqual([baseOperation])
  })

  it('records retry metadata after sync failure', () => {
    const result = markOfflineReviewOperationFailed({
      operation: baseOperation,
      errorMessage: '网络连接失败。',
      attemptedAt: '2026-06-13T08:10:00.000Z',
    })

    expect(result).toEqual({
      ...baseOperation,
      retryCount: 1,
      lastError: '网络连接失败。',
      lastAttemptAt: '2026-06-13T08:10:00.000Z',
    })
  })

  it('treats never-attempted offline review operations as ready', () => {
    expect(
      isOfflineReviewOperationReady({
        operation: baseOperation,
        now: '2026-06-13T08:00:00.000Z',
      }),
    ).toBe(true)
  })

  it('backs off recently failed offline review operations exponentially', () => {
    expect(
      isOfflineReviewOperationReady({
        operation: {
          ...baseOperation,
          retryCount: 2,
          lastAttemptAt: '2026-06-13T08:00:00.000Z',
        },
        now: '2026-06-13T08:01:00.000Z',
        baseDelayMs: 60_000,
      }),
    ).toBe(false)
  })

  it('allows failed offline review operations after the retry delay elapses', () => {
    expect(
      isOfflineReviewOperationReady({
        operation: {
          ...baseOperation,
          retryCount: 2,
          lastAttemptAt: '2026-06-13T08:00:00.000Z',
        },
        now: '2026-06-13T08:04:00.000Z',
        baseDelayMs: 60_000,
      }),
    ).toBe(true)
  })
})
