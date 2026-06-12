import { describe, expect, it } from 'vitest'
import { healthResponseSchema } from './health.js'

describe('healthResponseSchema', () => {
  it('accepts the public API health payload', () => {
    const result = healthResponseSchema.parse({
      status: 'ok',
      service: 'wordscodex-api',
    })

    expect(result.status).toBe('ok')
  })

  it('rejects unknown health states', () => {
    expect(() =>
      healthResponseSchema.parse({
        status: 'degraded',
        service: 'wordscodex-api',
      }),
    ).toThrow()
  })
})
