import 'fake-indexeddb/auto'
import type {
  StudySessionResponse,
  SubmitReviewRequest,
} from '@wordscodex/contracts'
import { afterEach, describe, expect, it } from 'vitest'
import { StudySessionCache } from './offline-session-cache'
import { OfflineReviewQueue } from './offline-review-queue'

const fixedIso = '2026-06-13T08:00:00.000Z'

const review: SubmitReviewRequest = {
  wordId: 'word_ability',
  questionType: 'word_to_meaning',
  rating: 'good',
  isCorrect: true,
  responseMs: 4200,
  answer: '认识',
  reviewedAt: fixedIso,
}

const sessionResponse: StudySessionResponse = {
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
        word: {
          id: 'word_ability',
          lemma: 'ability',
          phoneticUk: null,
          phoneticUs: null,
          audioUkUrl: null,
          audioUsUrl: null,
          imageUrl: null,
          meanings: [
            {
              partOfSpeech: 'n.',
              definitionZh: '能力；才能',
              definitionEn: null,
            },
          ],
          examples: [],
        },
      },
    ],
  },
  reviews: [],
}

const databaseNames: string[] = []

function createDatabaseName() {
  const name = `wordscodex_review_queue_${crypto.randomUUID()}`
  databaseNames.push(name)
  return name
}

describe('OfflineReviewQueue', () => {
  afterEach(async () => {
    await Promise.all(databaseNames.splice(0).map(deleteDatabase))
  })

  it('enqueues and dedupes a pending review by idempotency key', async () => {
    const queue = new OfflineReviewQueue({
      databaseName: createDatabaseName(),
      now: () => new Date(fixedIso),
    })

    await queue.enqueue({
      sessionId: 'session_123',
      idempotencyKey: 'idem_1',
      review,
      lastError: '网络连接失败。',
    })
    await queue.enqueue({
      sessionId: 'session_123',
      idempotencyKey: 'idem_1',
      review: {
        ...review,
        answer: '认识',
      },
      lastError: '请求超时。',
    })

    const pending = await queue.listBySession('session_123')

    expect(pending).toHaveLength(1)
    expect(pending[0]).toMatchObject({
      idempotencyKey: 'idem_1',
      sessionId: 'session_123',
      review,
      retryCount: 0,
      lastError: '请求超时。',
      lastAttemptAt: null,
    })
  })

  it('lists pending reviews for one session by created time', async () => {
    const queue = new OfflineReviewQueue({
      databaseName: createDatabaseName(),
    })

    await queue.enqueue({
      sessionId: 'session_123',
      idempotencyKey: 'idem_2',
      review: {
        ...review,
        wordId: 'word_absorb',
      },
      createdAt: '2026-06-13T08:05:00.000Z',
      lastError: null,
    })
    await queue.enqueue({
      sessionId: 'session_123',
      idempotencyKey: 'idem_1',
      review,
      createdAt: '2026-06-13T08:00:00.000Z',
      lastError: null,
    })
    await queue.enqueue({
      sessionId: 'session_other',
      idempotencyKey: 'idem_other',
      review,
      createdAt: '2026-06-13T08:01:00.000Z',
      lastError: null,
    })

    await expect(queue.listBySession('session_123')).resolves.toMatchObject([
      { idempotencyKey: 'idem_1' },
      { idempotencyKey: 'idem_2' },
    ])
  })

  it('records retry metadata after sync failure', async () => {
    const queue = new OfflineReviewQueue({
      databaseName: createDatabaseName(),
      now: () => new Date('2026-06-13T08:10:00.000Z'),
    })

    await queue.enqueue({
      sessionId: 'session_123',
      idempotencyKey: 'idem_1',
      review,
      lastError: null,
    })
    await queue.markFailed('idem_1', '网络连接失败。')

    const pending = await queue.listBySession('session_123')

    expect(pending[0]).toMatchObject({
      retryCount: 1,
      lastError: '网络连接失败。',
      lastAttemptAt: '2026-06-13T08:10:00.000Z',
    })
  })

  it('lists only reviews whose retry delay has elapsed', async () => {
    const queue = new OfflineReviewQueue({
      databaseName: createDatabaseName(),
      now: () => new Date('2026-06-13T08:03:00.000Z'),
    })

    await queue.enqueue({
      sessionId: 'session_123',
      idempotencyKey: 'ready',
      review,
      createdAt: '2026-06-13T08:00:00.000Z',
      lastError: null,
    })
    await queue.enqueue({
      sessionId: 'session_123',
      idempotencyKey: 'blocked',
      review: {
        ...review,
        wordId: 'word_absorb',
      },
      createdAt: '2026-06-13T08:01:00.000Z',
      lastError: null,
    })
    await queue.markFailed('blocked', '网络连接失败。')

    await expect(queue.listReady()).resolves.toMatchObject([
      {
        idempotencyKey: 'ready',
      },
    ])
  })

  it('summarizes pending reviews for the sync center', async () => {
    const queue = new OfflineReviewQueue({
      databaseName: createDatabaseName(),
      now: () => new Date('2026-06-13T08:03:00.000Z'),
    })

    await queue.enqueue({
      sessionId: 'session_123',
      idempotencyKey: 'ready',
      review,
      createdAt: '2026-06-13T08:00:00.000Z',
      lastError: null,
    })
    await queue.enqueue({
      sessionId: 'session_123',
      idempotencyKey: 'blocked',
      review: {
        ...review,
        wordId: 'word_absorb',
      },
      createdAt: '2026-06-13T08:01:00.000Z',
      lastError: null,
    })
    await queue.markFailed('blocked', '网络连接失败。')

    await expect(queue.getSummary()).resolves.toMatchObject({
      pendingCount: 2,
      readyCount: 1,
      nextRetryAt: '2026-06-13T08:04:00.000Z',
      lastError: '网络连接失败。',
    })
  })

  it('deletes a pending review after successful sync', async () => {
    const queue = new OfflineReviewQueue({
      databaseName: createDatabaseName(),
    })

    await queue.enqueue({
      sessionId: 'session_123',
      idempotencyKey: 'idem_1',
      review,
      lastError: null,
    })
    await queue.markSynced('idem_1')

    await expect(queue.listBySession('session_123')).resolves.toEqual([])
  })

  it('shares the offline database schema with the study session cache', async () => {
    const databaseName = createDatabaseName()
    const cache = new StudySessionCache({
      databaseName,
      now: () => new Date(fixedIso),
    })
    const queue = new OfflineReviewQueue({
      databaseName,
      now: () => new Date(fixedIso),
    })

    await cache.save(sessionResponse, new Date(fixedIso))
    await queue.enqueue({
      sessionId: 'session_123',
      idempotencyKey: 'idem_1',
      review,
      lastError: '网络连接失败。',
    })

    await expect(cache.load('session_123')).resolves.toMatchObject({
      session: {
        id: 'session_123',
      },
    })
    await expect(queue.listBySession('session_123')).resolves.toMatchObject([
      {
        idempotencyKey: 'idem_1',
      },
    ])
  })
})

function deleteDatabase(name: string) {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => {
      reject(
        request.error instanceof Error
          ? request.error
          : new Error(`Failed to delete IndexedDB database ${name}`),
      )
    }
    request.onblocked = () => resolve()
  })
}
