import {
  authSessionResponseSchema,
  type AuthErrorCode,
  type AuthSessionResponse,
  type User,
} from '@wordscodex/contracts'
import { beforeEach, describe, expect, it } from 'vitest'
import { AuthService, type AuthRepository } from './auth-service.js'
import { InMemoryVerificationCodeStore } from './code-store.js'
import { TokenService } from './token-service.js'

type SessionRecord = {
  id: string
  userId: string
  refreshTokenHash: string
  expiresAt: Date
  revokedAt: Date | null
  user?: User
}

class MemoryAuthRepository implements AuthRepository {
  private readonly users = new Map<string, User>()
  private readonly userIdsByEmail = new Map<string, string>()
  private readonly sessions = new Map<string, SessionRecord>()
  private nextUserIndex = 1
  private nextSessionIndex = 1

  seedRegisteredUser(email: string) {
    return this.saveUser({
      id: `user_${this.nextUserIndex.toString()}`,
      email,
      displayName: '学习者',
      role: 'learner',
      accountType: 'registered',
      timezone: 'Asia/Shanghai',
      createdAt: '2026-06-12T00:00:00.000Z',
      updatedAt: '2026-06-12T00:00:00.000Z',
    })
  }

  createGuest(timezone: string) {
    return Promise.resolve(
      this.saveUser({
        id: `user_${this.nextUserIndex.toString()}`,
        email: null,
        displayName: '学习者',
        role: 'learner',
        accountType: 'guest',
        timezone,
        createdAt: '2026-06-12T00:00:00.000Z',
        updatedAt: '2026-06-12T00:00:00.000Z',
      }),
    )
  }

  registerOrUpgrade(input: {
    email: string
    timezone: string
    guestUserId?: string
  }) {
    const existingUserId = this.userIdsByEmail.get(input.email)

    if (input.guestUserId) {
      if (existingUserId && existingUserId !== input.guestUserId) {
        const error = new Error('Email is already in use')
        error.name = 'EmailInUseError'
        return Promise.reject(error)
      }

      const guest = this.users.get(input.guestUserId)
      if (!guest) throw new Error('Guest user does not exist')
      return Promise.resolve(
        this.saveUser({
          ...guest,
          email: input.email,
          accountType: 'registered',
          timezone: input.timezone,
          updatedAt: '2026-06-12T00:00:00.000Z',
        }),
      )
    }

    if (existingUserId) {
      const existing = this.users.get(existingUserId)
      if (!existing) throw new Error('User index is corrupt')
      return Promise.resolve(existing)
    }

    return Promise.resolve(
      this.saveUser({
        id: `user_${this.nextUserIndex.toString()}`,
        email: input.email,
        displayName: '学习者',
        role: 'learner',
        accountType: 'registered',
        timezone: input.timezone,
        createdAt: '2026-06-12T00:00:00.000Z',
        updatedAt: '2026-06-12T00:00:00.000Z',
      }),
    )
  }

  findUserById(userId: string) {
    return Promise.resolve(this.users.get(userId) ?? null)
  }

  createSession(input: {
    userId: string
    refreshTokenHash: string
    expiresAt: Date
  }) {
    const session = {
      id: `session_${this.nextSessionIndex.toString()}`,
      userId: input.userId,
      refreshTokenHash: input.refreshTokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
    }
    this.nextSessionIndex += 1
    this.sessions.set(session.id, session)
    return Promise.resolve(session)
  }

  findSessionByHash(refreshTokenHash: string) {
    const session = [...this.sessions.values()].find(
      (candidate) => candidate.refreshTokenHash === refreshTokenHash,
    )
    if (!session) return Promise.resolve(null)
    return Promise.resolve({
      ...session,
      user: this.users.get(session.userId) ?? null,
    })
  }

  rotateSession(input: {
    sessionId: string
    currentRefreshTokenHash: string
    nextRefreshTokenHash: string
    expiresAt: Date
  }) {
    const session = this.sessions.get(input.sessionId)
    if (
      !session ||
      session.revokedAt ||
      session.refreshTokenHash !== input.currentRefreshTokenHash
    ) {
      return Promise.resolve(null)
    }

    session.refreshTokenHash = input.nextRefreshTokenHash
    session.expiresAt = input.expiresAt
    return Promise.resolve(session)
  }

  revokeSession(refreshTokenHash: string) {
    const session = [...this.sessions.values()].find(
      (candidate) => candidate.refreshTokenHash === refreshTokenHash,
    )
    if (session) session.revokedAt = new Date('2026-06-12T00:00:00.000Z')
    return Promise.resolve()
  }

  deleteUser(userId: string) {
    const user = this.users.get(userId)
    if (user?.email) this.userIdsByEmail.delete(user.email)
    this.users.delete(userId)
    for (const [sessionId, session] of this.sessions) {
      if (session.userId === userId) this.sessions.delete(sessionId)
    }
    return Promise.resolve()
  }

  private saveUser(user: User) {
    const nextUser = { ...user }
    this.users.set(nextUser.id, nextUser)
    if (nextUser.email) this.userIdsByEmail.set(nextUser.email, nextUser.id)
    this.nextUserIndex += 1
    return nextUser
  }
}

function expectSessionResponse(response: AuthSessionResponse) {
  expect(authSessionResponseSchema.parse(response)).toEqual(response)
  expect(response.expiresInSeconds).toBe(900)
}

async function expectAuthError(promise: Promise<unknown>, code: AuthErrorCode) {
  await expect(promise).rejects.toMatchObject({ code })
}

describe('AuthService', () => {
  const now = new Date('2026-06-12T00:00:00.000Z')
  let repository: MemoryAuthRepository
  let service: AuthService

  beforeEach(() => {
    repository = new MemoryAuthRepository()
    service = new AuthService({
      repository,
      codeStore: new InMemoryVerificationCodeStore(),
      tokenService: new TokenService(
        'test-secret-at-least-thirty-two-characters',
      ),
      codeSender: {
        sendCode: () => Promise.resolve(),
      },
      nodeEnv: 'test',
      authDevCode: '123456',
    })
  })

  it('requests a code without revealing whether an account exists', async () => {
    repository.seedRegisteredUser('known@example.com')

    await expect(
      service.requestCode({ email: 'known@example.com', now }),
    ).resolves.toEqual({
      accepted: true,
      expiresInSeconds: 600,
    })
    await expect(
      service.requestCode({ email: 'new@example.com', now }),
    ).resolves.toEqual({
      accepted: true,
      expiresInSeconds: 600,
    })
  })

  it('creates a registered user after a valid code', async () => {
    await service.requestCode({ email: 'learner@example.com', now })

    const result = await service.verifyCode({
      email: 'learner@example.com',
      code: '123456',
      timezone: 'Asia/Shanghai',
      now,
    })

    expectSessionResponse(result.response)
    expect(result.response.user).toMatchObject({
      email: 'learner@example.com',
      accountType: 'registered',
    })
    expect(JSON.stringify(result.response)).not.toContain(result.refreshToken)
  })

  it('upgrades an authenticated guest without changing its user id', async () => {
    const guest = await service.createGuest({
      timezone: 'Asia/Shanghai',
      now,
    })
    await service.requestCode({ email: 'learner@example.com', now })

    const result = await service.verifyCode({
      email: 'learner@example.com',
      code: '123456',
      timezone: 'Asia/Shanghai',
      guestAccessToken: guest.response.accessToken,
      now,
    })

    expectSessionResponse(result.response)
    expect(result.response.user.id).toBe(guest.response.user.id)
    expect(result.response.user.accountType).toBe('registered')
  })

  it('rejects a code after five invalid attempts', async () => {
    await service.requestCode({ email: 'learner@example.com', now })

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expectAuthError(
        service.verifyCode({
          email: 'learner@example.com',
          code: '000000',
          timezone: 'Asia/Shanghai',
          now,
        }),
        'AUTH_CODE_INVALID',
      )
    }
    await expectAuthError(
      service.verifyCode({
        email: 'learner@example.com',
        code: '000000',
        timezone: 'Asia/Shanghai',
        now,
      }),
      'AUTH_CODE_ATTEMPTS_EXCEEDED',
    )
  })

  it('creates a guest session', async () => {
    const result = await service.createGuest({
      timezone: 'Asia/Shanghai',
      now,
    })

    expectSessionResponse(result.response)
    expect(result.response.user).toMatchObject({
      email: null,
      accountType: 'guest',
    })
    expect(JSON.stringify(result.response)).not.toContain(result.refreshToken)
  })

  it('rotates a refresh token and rejects replay', async () => {
    const session = await service.createGuest({
      timezone: 'Asia/Shanghai',
      now,
    })

    const refreshed = await service.refresh({
      refreshToken: session.refreshToken,
      now,
    })

    expectSessionResponse(refreshed.response)
    expect(refreshed.refreshToken).not.toBe(session.refreshToken)
    await expectAuthError(
      service.refresh({ refreshToken: session.refreshToken, now }),
      'UNAUTHORIZED',
    )
  })

  it('revokes the current session during logout', async () => {
    const session = await service.createGuest({
      timezone: 'Asia/Shanghai',
      now,
    })

    await service.logout(session.refreshToken)

    await expectAuthError(
      service.refresh({ refreshToken: session.refreshToken, now }),
      'UNAUTHORIZED',
    )
  })

  it('returns the current user for a valid access token', async () => {
    const session = await service.createGuest({
      timezone: 'Asia/Shanghai',
      now,
    })

    await expect(
      service.getCurrentUser(session.response.accessToken),
    ).resolves.toEqual(session.response.user)
  })

  it('deletes the current user and rejects the same access token afterwards', async () => {
    const session = await service.createGuest({
      timezone: 'Asia/Shanghai',
      now,
    })

    await expect(
      service.deleteCurrentUser(session.response.accessToken),
    ).resolves.toEqual({
      deleted: true,
      anonymizedAnalytics: true,
    })
    await expectAuthError(
      service.getCurrentUser(session.response.accessToken),
      'UNAUTHORIZED',
    )
  })
})
