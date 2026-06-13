import { randomInt } from 'node:crypto'
import type {
  AuthErrorCode,
  AuthSessionResponse,
  DeleteAccountResponse,
} from '@wordscodex/contracts'
import type { VerificationCodeStore, VerifyCodeResult } from './code-store.js'
import type { TokenService } from './token-service.js'

type NodeEnv = 'development' | 'test' | 'production'
type DateLike = Date | string

export type AuthUserRecord = {
  id: string
  email: string | null
  displayName: string
  role: 'learner' | 'admin'
  accountType: 'guest' | 'registered'
  timezone: string
  createdAt: DateLike
  updatedAt: DateLike
}

export type AuthSessionRecord = {
  id: string
  userId: string
  refreshTokenHash: string
  expiresAt: Date
  revokedAt: Date | null
  user?: AuthUserRecord | null
}

export interface AuthRepository {
  createGuest(timezone: string): Promise<AuthUserRecord>
  registerOrUpgrade(input: {
    email: string
    timezone: string
    guestUserId?: string
  }): Promise<AuthUserRecord>
  findUserById(userId: string): Promise<AuthUserRecord | null>
  createSession(input: {
    userId: string
    refreshTokenHash: string
    expiresAt: Date
  }): Promise<object>
  findSessionByHash(refreshTokenHash: string): Promise<AuthSessionRecord | null>
  rotateSession(input: {
    sessionId: string
    currentRefreshTokenHash: string
    nextRefreshTokenHash: string
    expiresAt: Date
  }): Promise<object | null>
  revokeSession(refreshTokenHash: string): Promise<void>
  deleteUser(userId: string): Promise<void>
}

export interface VerificationCodeSender {
  sendCode(input: { email: string; code: string }): Promise<void>
}

export class AuthServiceError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code)
    this.name = 'AuthServiceError'
  }
}

export class AuthService {
  private readonly nodeEnv: NodeEnv
  private readonly authDevCode: string | undefined

  constructor(
    private readonly dependencies: {
      repository: AuthRepository
      codeStore: VerificationCodeStore
      tokenService: TokenService
      codeSender: VerificationCodeSender
      nodeEnv?: NodeEnv
      authDevCode?: string
    },
  ) {
    this.nodeEnv = dependencies.nodeEnv ?? 'development'
    this.authDevCode = dependencies.authDevCode
  }

  async requestCode(input: { email: string; now?: Date }) {
    const now = input.now ?? new Date()
    const code = this.createVerificationCode()
    const codeHash = this.dependencies.tokenService.hashVerificationCode(
      input.email,
      code,
    )
    const result = await this.dependencies.codeStore.issue(
      input.email,
      codeHash,
      now,
    )

    if (result === 'rate_limited') {
      throw new AuthServiceError('AUTH_CODE_RATE_LIMITED')
    }

    await this.dependencies.codeSender.sendCode({
      email: input.email,
      code,
    })

    return {
      accepted: true as const,
      expiresInSeconds: 600 as const,
    }
  }

  async verifyCode(input: {
    email: string
    code: string
    timezone: string
    guestAccessToken?: string
    now?: Date
  }): Promise<{
    response: AuthSessionResponse
    refreshToken: string
  }> {
    const now = input.now ?? new Date()
    const guestUserId = input.guestAccessToken
      ? await this.getGuestUserId(input.guestAccessToken)
      : undefined
    const codeHash = this.dependencies.tokenService.hashVerificationCode(
      input.email,
      input.code,
    )
    const result = await this.dependencies.codeStore.verify(
      input.email,
      codeHash,
      now,
    )

    this.assertVerificationResult(result)

    try {
      const user = await this.dependencies.repository.registerOrUpgrade({
        email: input.email,
        timezone: input.timezone,
        ...(guestUserId ? { guestUserId } : {}),
      })
      return this.createSessionResult(user, now)
    } catch (error) {
      if (isEmailInUseError(error)) {
        throw new AuthServiceError('ACCOUNT_EMAIL_IN_USE')
      }
      throw error
    }
  }

  async createGuest(input: { timezone: string; now?: Date }): Promise<{
    response: AuthSessionResponse
    refreshToken: string
  }> {
    const user = await this.dependencies.repository.createGuest(input.timezone)
    return this.createSessionResult(user, input.now ?? new Date())
  }

  async refresh(input: { refreshToken: string; now?: Date }): Promise<{
    response: AuthSessionResponse
    refreshToken: string
  }> {
    const now = input.now ?? new Date()
    const currentRefreshTokenHash =
      this.dependencies.tokenService.hashRefreshToken(input.refreshToken)
    const session = await this.dependencies.repository.findSessionByHash(
      currentRefreshTokenHash,
    )

    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= now.getTime() ||
      !session.user
    ) {
      throw new AuthServiceError('UNAUTHORIZED')
    }

    const nextRefreshToken = this.dependencies.tokenService.createRefreshToken()
    const nextRefreshTokenHash =
      this.dependencies.tokenService.hashRefreshToken(nextRefreshToken)
    const rotated = await this.dependencies.repository.rotateSession({
      sessionId: session.id,
      currentRefreshTokenHash,
      nextRefreshTokenHash,
      expiresAt: createRefreshExpiresAt(now),
    })

    if (!rotated) throw new AuthServiceError('UNAUTHORIZED')

    return {
      response: await this.createSessionResponse(session.user),
      refreshToken: nextRefreshToken,
    }
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return
    await this.dependencies.repository.revokeSession(
      this.dependencies.tokenService.hashRefreshToken(refreshToken),
    )
  }

  async getCurrentUser(accessToken: string) {
    try {
      const payload =
        await this.dependencies.tokenService.verifyAccessToken(accessToken)
      const user = await this.dependencies.repository.findUserById(
        payload.userId,
      )
      if (!user) throw new AuthServiceError('UNAUTHORIZED')
      return toPublicUser(user)
    } catch (error) {
      if (error instanceof AuthServiceError) throw error
      throw new AuthServiceError('UNAUTHORIZED')
    }
  }

  async deleteCurrentUser(accessToken: string): Promise<DeleteAccountResponse> {
    try {
      const payload =
        await this.dependencies.tokenService.verifyAccessToken(accessToken)
      const user = await this.dependencies.repository.findUserById(
        payload.userId,
      )
      if (!user) throw new AuthServiceError('UNAUTHORIZED')

      await this.dependencies.repository.deleteUser(user.id)

      return {
        deleted: true,
        anonymizedAnalytics: true,
      }
    } catch (error) {
      if (error instanceof AuthServiceError) throw error
      throw new AuthServiceError('UNAUTHORIZED')
    }
  }

  private createVerificationCode() {
    if (this.nodeEnv !== 'production' && this.authDevCode) {
      return this.authDevCode
    }
    return randomInt(0, 1_000_000).toString().padStart(6, '0')
  }

  private assertVerificationResult(result: VerifyCodeResult) {
    if (result === 'valid') return
    if (result === 'attempts_exceeded') {
      throw new AuthServiceError('AUTH_CODE_ATTEMPTS_EXCEEDED')
    }
    throw new AuthServiceError('AUTH_CODE_INVALID')
  }

  private async getGuestUserId(accessToken: string) {
    try {
      const payload =
        await this.dependencies.tokenService.verifyAccessToken(accessToken)
      const user = await this.dependencies.repository.findUserById(
        payload.userId,
      )
      if (!user || user.accountType !== 'guest') {
        throw new AuthServiceError('UNAUTHORIZED')
      }
      return user.id
    } catch (error) {
      if (error instanceof AuthServiceError) throw error
      throw new AuthServiceError('UNAUTHORIZED')
    }
  }

  private async createSessionResult(
    user: AuthUserRecord,
    now: Date,
  ): Promise<{
    response: AuthSessionResponse
    refreshToken: string
  }> {
    const refreshToken = this.dependencies.tokenService.createRefreshToken()
    await this.dependencies.repository.createSession({
      userId: user.id,
      refreshTokenHash:
        this.dependencies.tokenService.hashRefreshToken(refreshToken),
      expiresAt: createRefreshExpiresAt(now),
    })

    return {
      response: await this.createSessionResponse(user),
      refreshToken,
    }
  }

  private async createSessionResponse(
    user: AuthUserRecord,
  ): Promise<AuthSessionResponse> {
    return {
      accessToken: await this.dependencies.tokenService.createAccessToken(
        user.id,
      ),
      expiresInSeconds: 900,
      user: toPublicUser(user),
    }
  }
}

function createRefreshExpiresAt(now: Date) {
  return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
}

function toPublicUser(user: AuthUserRecord) {
  return {
    ...user,
    createdAt: toIsoString(user.createdAt),
    updatedAt: toIsoString(user.updatedAt),
  }
}

function toIsoString(value: DateLike) {
  return value instanceof Date ? value.toISOString() : value
}

function isEmailInUseError(error: unknown) {
  if (!(error instanceof Error)) return false
  return (
    error.name === 'EmailInUseError' ||
    error.constructor.name === 'EmailInUseError'
  )
}
