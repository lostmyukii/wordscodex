import type { User } from '@wordscodex/contracts'
import type { PrismaClient } from '../../../generated/prisma/client.js'

function toUser(record: {
  id: string
  email: string | null
  displayName: string
  role: 'learner' | 'admin'
  accountType: 'guest' | 'registered'
  timezone: string
  createdAt: Date
  updatedAt: Date
}): User {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

export class EmailInUseError extends Error {}

export class PrismaAuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createGuest(timezone: string) {
    return toUser(
      await this.prisma.user.create({
        data: {
          timezone,
        },
      }),
    )
  }

  async registerOrUpgrade(input: {
    email: string
    timezone: string
    guestUserId?: string
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
    })

    if (input.guestUserId) {
      if (existing && existing.id !== input.guestUserId) {
        throw new EmailInUseError()
      }
      return toUser(
        await this.prisma.user.update({
          where: { id: input.guestUserId },
          data: {
            email: input.email,
            accountType: 'registered',
            timezone: input.timezone,
          },
        }),
      )
    }

    if (existing) {
      return toUser(existing)
    }

    return toUser(
      await this.prisma.user.create({
        data: {
          email: input.email,
          accountType: 'registered',
          timezone: input.timezone,
        },
      }),
    )
  }

  async findUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })
    return user ? toUser(user) : null
  }

  createSession(input: {
    userId: string
    refreshTokenHash: string
    expiresAt: Date
  }) {
    return this.prisma.authSession.create({ data: input })
  }

  findSessionByHash(refreshTokenHash: string) {
    return this.prisma.authSession.findUnique({
      where: { refreshTokenHash },
      include: { user: true },
    })
  }

  async rotateSession(input: {
    sessionId: string
    currentRefreshTokenHash: string
    nextRefreshTokenHash: string
    expiresAt: Date
  }) {
    const rotated = await this.prisma.authSession.updateMany({
      where: {
        id: input.sessionId,
        refreshTokenHash: input.currentRefreshTokenHash,
        revokedAt: null,
      },
      data: {
        refreshTokenHash: input.nextRefreshTokenHash,
        expiresAt: input.expiresAt,
      },
    })
    if (rotated.count !== 1) return null
    return this.prisma.authSession.findUnique({
      where: { id: input.sessionId },
    })
  }

  async revokeSession(refreshTokenHash: string) {
    await this.prisma.authSession.updateMany({
      where: {
        refreshTokenHash,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    })
  }

  async deleteUser(userId: string) {
    await this.prisma.user.delete({
      where: {
        id: userId,
      },
    })
  }
}
