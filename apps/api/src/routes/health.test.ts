import { healthResponseSchema } from '@wordscodex/contracts'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.js'

describe('GET /api/v1/health', () => {
  const app = buildApp()

  afterEach(async () => {
    await app.close()
  })

  it('returns a contract-valid health response', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    })

    expect(response.statusCode).toBe(200)
    expect(healthResponseSchema.parse(response.json())).toEqual({
      status: 'ok',
      service: 'wordscodex-api',
    })
  })
})
