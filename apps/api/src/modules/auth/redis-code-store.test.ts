import { createClient, type RedisClientType } from 'redis'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RedisVerificationCodeStore } from './redis-code-store.js'

describe('RedisVerificationCodeStore', () => {
  let redis: RedisClientType
  let store: RedisVerificationCodeStore

  beforeEach(async () => {
    redis = createClient({
      url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379/15',
    })
    await redis.connect()
    await redis.flushDb()
    store = new RedisVerificationCodeStore(redis)
  })

  afterEach(async () => {
    if (redis?.isOpen) {
      await redis.flushDb()
      await redis.quit()
    }
  })

  it('enforces resend cooldown and consumes a valid code', async () => {
    const now = new Date('2026-06-12T00:00:00.000Z')

    expect(await store.issue('a@example.com', 'hash', now)).toBe('issued')
    expect(await store.issue('a@example.com', 'hash', now)).toBe('rate_limited')
    expect(await store.verify('a@example.com', 'hash', now)).toBe('valid')
    expect(await store.verify('a@example.com', 'hash', now)).toBe('invalid')
  })

  it('locks the code after five invalid attempts', async () => {
    const now = new Date('2026-06-12T00:00:00.000Z')
    await store.issue('a@example.com', 'correct', now)

    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect(await store.verify('a@example.com', 'wrong', now)).toBe('invalid')
    }
    expect(await store.verify('a@example.com', 'wrong', now)).toBe(
      'attempts_exceeded',
    )
  })

  it('treats an expired code as invalid', async () => {
    const now = new Date('2026-06-12T00:00:00.000Z')
    await store.issue('a@example.com', 'hash', now)
    const [codeKey] = await redis.keys('auth:code:*')

    expect(codeKey).toBeDefined()
    if (!codeKey) throw new Error('Code key was not created')
    await redis.expire(codeKey, 0)

    expect(await store.verify('a@example.com', 'hash', now)).toBe('invalid')
  })

  it('does not store raw email or raw code in Redis keys or values', async () => {
    const now = new Date('2026-06-12T00:00:00.000Z')
    await store.issue('secret@example.com', 'hashed-code', now)

    const keys = await redis.keys('auth:*')
    const dump = await Promise.all(
      keys.map(async (key) => {
        const type = await redis.type(key)
        const value =
          type === 'hash' ? await redis.hGetAll(key) : await redis.get(key)
        return `${key}:${JSON.stringify(value)}`
      }),
    )

    expect(dump.join('\n')).not.toContain('secret@example.com')
    expect(dump.join('\n')).not.toContain('123456')
  })
})
