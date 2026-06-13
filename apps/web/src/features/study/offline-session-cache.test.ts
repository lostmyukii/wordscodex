import 'fake-indexeddb/auto'
import type { StudySessionResponse } from '@wordscodex/contracts'
import { afterEach, describe, expect, it } from 'vitest'
import { StudySessionCache } from './offline-session-cache'

const fixedIso = '2026-06-13T00:00:00.000Z'

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
          examples: [],
        },
      },
    ],
  },
  reviews: [],
}

const databaseNames: string[] = []

function createDatabaseName() {
  const name = `wordscodex_test_${crypto.randomUUID()}`
  databaseNames.push(name)
  return name
}

describe('StudySessionCache', () => {
  afterEach(async () => {
    await Promise.all(databaseNames.splice(0).map(deleteDatabase))
  })

  it('saves and loads a cached study session response by session id', async () => {
    const cache = new StudySessionCache({
      databaseName: createDatabaseName(),
    })

    await cache.save(sessionResponse, new Date('2026-06-13T08:00:00.000Z'))

    await expect(cache.load('session_123')).resolves.toMatchObject({
      session: {
        id: 'session_123',
      },
      reviews: [],
    })
  })

  it('returns null when the session is missing', async () => {
    const cache = new StudySessionCache({
      databaseName: createDatabaseName(),
    })

    await expect(cache.load('missing_session')).resolves.toBeNull()
  })

  it('does not load an expired cached session', async () => {
    const cache = new StudySessionCache({
      databaseName: createDatabaseName(),
      ttlDays: 7,
      now: () => new Date('2026-06-21T00:00:00.000Z'),
    })

    await cache.save(sessionResponse, new Date('2026-06-13T00:00:00.000Z'))

    await expect(cache.load('session_123')).resolves.toBeNull()
  })

  it('removes expired sessions while keeping fresh sessions', async () => {
    const cache = new StudySessionCache({
      databaseName: createDatabaseName(),
      ttlDays: 7,
      now: () => new Date('2026-06-21T00:00:00.000Z'),
    })

    await cache.save(sessionResponse, new Date('2026-06-13T00:00:00.000Z'))
    await cache.save(
      {
        ...sessionResponse,
        session: {
          ...sessionResponse.session,
          id: 'session_fresh',
        },
      },
      new Date('2026-06-20T00:00:00.000Z'),
    )

    await cache.clearExpired()

    await expect(cache.load('session_123')).resolves.toBeNull()
    await expect(cache.load('session_fresh')).resolves.toMatchObject({
      session: {
        id: 'session_fresh',
      },
    })
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
