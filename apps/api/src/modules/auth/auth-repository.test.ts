import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, describe, expect, it } from 'vitest'
import { prisma } from '../../shared/prisma.js'
import { PrismaAuthRepository } from './auth-repository.js'

describe('PrismaAuthRepository', () => {
  const repository = new PrismaAuthRepository(prisma)
  const createdUserIds: string[] = []

  afterEach(async () => {
    await prisma.user.deleteMany({
      where: {
        id: {
          in: createdUserIds.splice(0),
        },
      },
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('creates a guest and upgrades the same user with an unused email', async () => {
    const guest = await repository.createGuest('Asia/Shanghai')
    createdUserIds.push(guest.id)
    const registered = await repository.registerOrUpgrade({
      email: `${randomUUID()}@example.com`,
      timezone: 'Asia/Shanghai',
      guestUserId: guest.id,
    })

    expect(registered.id).toBe(guest.id)
    expect(registered.accountType).toBe('registered')
  })

  it('rotates a refresh session only once', async () => {
    const user = await repository.createGuest('Asia/Shanghai')
    createdUserIds.push(user.id)
    const session = await repository.createSession({
      userId: user.id,
      refreshTokenHash: 'old-hash',
      expiresAt: new Date(Date.now() + 60_000),
    })

    expect(
      await repository.rotateSession({
        sessionId: session.id,
        currentRefreshTokenHash: 'old-hash',
        nextRefreshTokenHash: 'new-hash',
        expiresAt: new Date(Date.now() + 120_000),
      }),
    ).not.toBeNull()
    expect(
      await repository.rotateSession({
        sessionId: session.id,
        currentRefreshTokenHash: 'old-hash',
        nextRefreshTokenHash: 'replay-hash',
        expiresAt: new Date(Date.now() + 120_000),
      }),
    ).toBeNull()
  })
})
