import { describe, expect, it } from 'vitest'
import { InMemoryVerificationCodeStore } from './code-store.js'

describe('InMemoryVerificationCodeStore', () => {
  it('enforces resend cooldown and consumes a valid code', async () => {
    const store = new InMemoryVerificationCodeStore()
    const now = new Date('2026-06-12T00:00:00.000Z')

    expect(await store.issue('a@example.com', 'hash', now)).toBe('issued')
    expect(await store.issue('a@example.com', 'hash', now)).toBe('rate_limited')
    expect(await store.verify('a@example.com', 'hash', now)).toBe('valid')
    expect(await store.verify('a@example.com', 'hash', now)).toBe('invalid')
  })

  it('locks the code after five invalid attempts', async () => {
    const store = new InMemoryVerificationCodeStore()
    const now = new Date('2026-06-12T00:00:00.000Z')
    await store.issue('a@example.com', 'correct', now)

    for (let attempt = 0; attempt < 4; attempt += 1) {
      expect(await store.verify('a@example.com', 'wrong', now)).toBe('invalid')
    }
    expect(await store.verify('a@example.com', 'wrong', now)).toBe(
      'attempts_exceeded',
    )
  })
})
