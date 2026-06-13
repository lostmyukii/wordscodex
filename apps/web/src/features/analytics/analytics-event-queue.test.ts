import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { AnalyticsEventQueue } from './analytics-event-queue'

const fixedIso = '2026-06-13T08:00:00.000Z'

const databaseNames: string[] = []

function createDatabaseName() {
  const name = `wordscodex_analytics_${crypto.randomUUID()}`
  databaseNames.push(name)
  return name
}

describe('AnalyticsEventQueue', () => {
  afterEach(async () => {
    await Promise.all(databaseNames.splice(0).map(deleteDatabase))
  })

  it('enqueues and dedupes analytics events by client event id', async () => {
    const queue = new AnalyticsEventQueue({
      databaseName: createDatabaseName(),
      now: () => new Date(fixedIso),
    })

    await queue.enqueue({
      clientEventId: 'event_1',
      name: 'offline_queue_created',
      occurredAt: fixedIso,
      properties: {
        pendingCount: 1,
      },
      lastError: '网络连接失败。',
    })
    await queue.enqueue({
      clientEventId: 'event_1',
      name: 'offline_queue_created',
      occurredAt: fixedIso,
      properties: {
        pendingCount: 2,
      },
      lastError: '请求超时。',
    })

    await expect(queue.listReady()).resolves.toMatchObject([
      {
        clientEventId: 'event_1',
        properties: {
          pendingCount: 2,
        },
        retryCount: 0,
        lastError: '请求超时。',
      },
    ])
  })

  it('records retry metadata and deletes sent events', async () => {
    const queue = new AnalyticsEventQueue({
      databaseName: createDatabaseName(),
      now: () => new Date('2026-06-13T08:10:00.000Z'),
    })

    await queue.enqueue({
      clientEventId: 'event_1',
      name: 'offline_queue_synced',
      occurredAt: fixedIso,
      properties: {
        syncedCount: 1,
      },
      lastError: null,
    })
    await queue.markFailed('event_1', '服务暂时不可用。')

    await expect(queue.listReady()).resolves.toEqual([])

    await queue.markSent('event_1')

    await expect(queue.listReady()).resolves.toEqual([])
  })

  it('returns failed events only after their retry delay has elapsed', async () => {
    let now = new Date('2026-06-13T08:10:00.000Z')
    const queue = new AnalyticsEventQueue({
      databaseName: createDatabaseName(),
      now: () => now,
    })

    await queue.enqueue({
      clientEventId: 'event_retry',
      name: 'offline_queue_synced',
      occurredAt: fixedIso,
      properties: {
        syncedCount: 1,
      },
      lastError: null,
    })
    await queue.markFailed('event_retry', '服务暂时不可用。')

    now = new Date('2026-06-13T08:11:59.000Z')
    await expect(queue.listReady()).resolves.toEqual([])

    now = new Date('2026-06-13T08:12:00.000Z')
    await expect(queue.listReady()).resolves.toMatchObject([
      {
        clientEventId: 'event_retry',
        retryCount: 1,
      },
    ])
  })

  it('returns the oldest ready analytics events first with a batch limit', async () => {
    const queue = new AnalyticsEventQueue({
      databaseName: createDatabaseName(),
      now: () => new Date(fixedIso),
    })

    await queue.enqueue({
      clientEventId: 'event_newer',
      name: 'pwa_installed',
      occurredAt: '2026-06-13T08:02:00.000Z',
      properties: {},
      lastError: null,
    })
    await queue.enqueue({
      clientEventId: 'event_older',
      name: 'pwa_install_prompt_shown',
      occurredAt: '2026-06-13T08:01:00.000Z',
      properties: {},
      lastError: null,
    })

    await expect(queue.listReady(1)).resolves.toMatchObject([
      {
        clientEventId: 'event_older',
      },
    ])
  })
})

function deleteDatabase(name: string) {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () =>
      reject(request.error ?? new Error('Failed to delete IndexedDB database'))
    request.onblocked = () => resolve()
  })
}
