import { describe, expect, it } from 'vitest'
import { TokenService } from './token-service.js'

describe('TokenService', () => {
  const service = new TokenService('test-secret-at-least-thirty-two-characters')

  it('signs and verifies a short-lived access token', async () => {
    const token = await service.createAccessToken('user_123')

    await expect(service.verifyAccessToken(token)).resolves.toEqual({
      userId: 'user_123',
    })
  })

  it('creates opaque refresh tokens and deterministic hashes', () => {
    const token = service.createRefreshToken()

    expect(token).not.toContain('user_123')
    expect(service.hashRefreshToken(token)).toHaveLength(64)
  })
})
