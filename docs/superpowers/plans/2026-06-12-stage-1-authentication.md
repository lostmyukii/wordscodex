# Stage 1 Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver email verification-code login, guest access, refresh-token rotation, logout, current-user access, and a mobile-first Web login flow.

**Architecture:** Shared Zod contracts define the HTTP boundary. The Fastify auth module separates routes, orchestration, persistence, verification-code storage, and token work; PostgreSQL stores users and refresh sessions while Redis stores short-lived verification codes. The React app keeps access tokens only in a Zustand memory store and restores sessions through the HttpOnly refresh cookie.

**Tech Stack:** TypeScript, Zod, Fastify, Prisma, PostgreSQL, Redis, JOSE, React Router, TanStack Query, Zustand, React Hook Form, Vitest, Testing Library, Playwright

---

## Delivery Order

1. Shared authentication contracts
2. PostgreSQL user and refresh-session persistence
3. Verification-code stores
4. Token and authentication services
5. Fastify authentication routes
6. React login and guarded onboarding entry
7. Mobile authentication end-to-end coverage
8. CI, environment, and documentation verification

## Task 1: Define Shared Authentication Contracts

**Files:**
- Create: `packages/contracts/src/auth.ts`
- Create: `packages/contracts/src/auth.test.ts`
- Modify: `packages/contracts/src/index.ts`

- [x] **Step 1: Write failing contract tests**

Create `packages/contracts/src/auth.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  authSessionResponseSchema,
  errorResponseSchema,
  guestLoginRequestSchema,
  requestCodeRequestSchema,
  requestCodeResponseSchema,
  userSchema,
  verifyCodeRequestSchema,
} from './auth.js'

const user = {
  id: 'user_123',
  email: 'learner@example.com',
  displayName: '学习者',
  role: 'learner',
  accountType: 'registered',
  timezone: 'Asia/Shanghai',
  createdAt: '2026-06-12T00:00:00.000Z',
  updatedAt: '2026-06-12T00:00:00.000Z',
}

describe('authentication contracts', () => {
  it('normalizes a valid email request', () => {
    expect(
      requestCodeRequestSchema.parse({
        email: '  Learner@Example.COM ',
      }),
    ).toEqual({
      email: 'learner@example.com',
    })
  })

  it('requires a six digit verification code', () => {
    expect(() =>
      verifyCodeRequestSchema.parse({
        email: 'learner@example.com',
        code: '12345',
        timezone: 'Asia/Shanghai',
      }),
    ).toThrow()
  })

  it('accepts the public user and session payload', () => {
    expect(userSchema.parse(user)).toEqual(user)
    expect(
      authSessionResponseSchema.parse({
        accessToken: 'access-token',
        expiresInSeconds: 900,
        user,
      }),
    ).toMatchObject({
      expiresInSeconds: 900,
      user,
    })
  })

  it('accepts guest and request-code payloads', () => {
    expect(guestLoginRequestSchema.parse({})).toEqual({
      timezone: 'Asia/Shanghai',
    })
    expect(
      requestCodeResponseSchema.parse({
        accepted: true,
        expiresInSeconds: 600,
      }),
    ).toEqual({
      accepted: true,
      expiresInSeconds: 600,
    })
  })

  it('rejects unknown user roles and unstable error codes', () => {
    expect(() =>
      userSchema.parse({
        ...user,
        role: 'owner',
      }),
    ).toThrow()
    expect(() =>
      errorResponseSchema.parse({
        error: {
          code: 'UNKNOWN',
          message: '失败',
          requestId: 'req_123',
        },
      }),
    ).toThrow()
  })
})
```

- [x] **Step 2: Run the contracts test and verify RED**

Run:

```bash
pnpm --filter @wordscodex/contracts test -- auth.test.ts
```

Expected: FAIL because `packages/contracts/src/auth.ts` does not exist.

- [x] **Step 3: Implement authentication schemas and inferred types**

Create `packages/contracts/src/auth.ts`:

```ts
import { z } from 'zod'

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(254)

export const userSchema = z.object({
  id: z.string().min(1),
  email: emailSchema.nullable(),
  displayName: z.string().min(1).max(80),
  role: z.enum(['learner', 'admin']),
  accountType: z.enum(['guest', 'registered']),
  timezone: z.string().min(1).max(100),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const requestCodeRequestSchema = z.object({
  email: emailSchema,
})

export const requestCodeResponseSchema = z.object({
  accepted: z.literal(true),
  expiresInSeconds: z.literal(600),
})

export const verifyCodeRequestSchema = z.object({
  email: emailSchema,
  code: z.string().regex(/^\d{6}$/),
  timezone: z.string().min(1).max(100).default('Asia/Shanghai'),
})

export const guestLoginRequestSchema = z.object({
  timezone: z.string().min(1).max(100).default('Asia/Shanghai'),
})

export const authSessionResponseSchema = z.object({
  accessToken: z.string().min(1),
  expiresInSeconds: z.literal(900),
  user: userSchema,
})

export const authErrorCodeSchema = z.enum([
  'VALIDATION_FAILED',
  'AUTH_CODE_RATE_LIMITED',
  'AUTH_CODE_INVALID',
  'AUTH_CODE_ATTEMPTS_EXCEEDED',
  'ACCOUNT_EMAIL_IN_USE',
  'UNAUTHORIZED',
])

export const errorResponseSchema = z.object({
  error: z.object({
    code: authErrorCodeSchema,
    message: z.string().min(1),
    requestId: z.string().min(1),
  }),
})

export type User = z.infer<typeof userSchema>
export type RequestCodeRequest = z.infer<typeof requestCodeRequestSchema>
export type RequestCodeResponse = z.infer<typeof requestCodeResponseSchema>
export type VerifyCodeRequest = z.infer<typeof verifyCodeRequestSchema>
export type GuestLoginRequest = z.infer<typeof guestLoginRequestSchema>
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>
export type AuthErrorCode = z.infer<typeof authErrorCodeSchema>
export type ErrorResponse = z.infer<typeof errorResponseSchema>
```

Update `packages/contracts/src/index.ts`:

```ts
export {
  authErrorCodeSchema,
  authSessionResponseSchema,
  errorResponseSchema,
  guestLoginRequestSchema,
  requestCodeRequestSchema,
  requestCodeResponseSchema,
  userSchema,
  verifyCodeRequestSchema,
  type AuthErrorCode,
  type AuthSessionResponse,
  type ErrorResponse,
  type GuestLoginRequest,
  type RequestCodeRequest,
  type RequestCodeResponse,
  type User,
  type VerifyCodeRequest,
} from './auth.js'
export { healthResponseSchema, type HealthResponse } from './health.js'
```

- [x] **Step 4: Run the contracts test and verify GREEN**

Run:

```bash
pnpm --filter @wordscodex/contracts test -- auth.test.ts
pnpm --filter @wordscodex/contracts typecheck
```

Expected: five authentication contract tests pass and TypeScript exits 0.

- [x] **Step 5: Commit**

```bash
git add packages/contracts/src
git commit -m "feat: define authentication contracts"
```

## Task 2: Add User And Refresh Session Persistence

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_auth_models/migration.sql`
- Create: `apps/api/src/modules/auth/auth-repository.ts`
- Create: `apps/api/src/modules/auth/auth-repository.test.ts`
- Create: `apps/api/src/shared/prisma.ts`
- Modify: `apps/api/src/index.ts`

- [x] **Step 1: Add a failing Prisma repository test**

Create `apps/api/src/modules/auth/auth-repository.test.ts`:

```ts
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
```

- [x] **Step 2: Run the repository test and verify RED**

Run:

```bash
pnpm --filter @wordscodex/api test -- auth-repository.test.ts
```

Expected: FAIL because the auth repository and Prisma models do not exist.

- [x] **Step 3: Add Prisma models**

Replace `apps/api/prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}

enum UserRole {
  learner
  admin
}

enum AccountType {
  guest
  registered
}

model SystemMetadata {
  key       String   @id
  value     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model User {
  id          String        @id @default(cuid())
  email       String?       @unique
  displayName String        @default("学习者")
  role        UserRole      @default(learner)
  accountType AccountType   @default(guest)
  timezone    String        @default("Asia/Shanghai")
  sessions    AuthSession[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}

model AuthSession {
  id               String   @id @default(cuid())
  userId           String
  refreshTokenHash String   @unique
  expiresAt        DateTime
  revokedAt        DateTime?
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([userId])
  @@index([expiresAt])
}
```

Generate and apply the migration:

```bash
pnpm db:migrate --name add_auth_models
pnpm db:generate
```

Expected: Prisma creates one migration and regenerates the client.

- [x] **Step 4: Implement the Prisma client and repository**

Create `apps/api/src/shared/prisma.ts`:

```ts
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client.js'
import { env } from '../env.js'

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
})

export const prisma = new PrismaClient({ adapter })
```

Create `apps/api/src/modules/auth/auth-repository.ts` with:

```ts
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
}
```

Update `apps/api/src/index.ts` so shutdown disconnects Prisma:

```ts
import { buildApp } from './app.js'
import { env } from './env.js'
import { prisma } from './shared/prisma.js'

const app = buildApp()

const shutdown = async () => {
  await app.close()
  await prisma.$disconnect()
}

process.once('SIGINT', () => void shutdown())
process.once('SIGTERM', () => void shutdown())

await app.listen({
  host: env.API_HOST,
  port: env.API_PORT,
})
```

- [x] **Step 5: Run the repository test and verify GREEN**

Run:

```bash
pnpm --filter @wordscodex/api test -- auth-repository.test.ts
pnpm --filter @wordscodex/api typecheck
```

Expected: both repository tests pass and TypeScript exits 0.

- [x] **Step 6: Commit**

```bash
git add apps/api/prisma apps/api/src/modules/auth apps/api/src/shared apps/api/src/index.ts
git commit -m "feat: add authentication persistence"
```

## Task 3: Implement Verification Code Stores

**Files:**
- Modify: `apps/api/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/api/src/modules/auth/code-store.ts`
- Create: `apps/api/src/modules/auth/code-store.test.ts`
- Create: `apps/api/src/modules/auth/redis-code-store.ts`
- Create: `apps/api/src/modules/auth/redis-code-store.test.ts`

- [x] **Step 1: Install the Redis client**

Run:

```bash
pnpm --filter @wordscodex/api add redis@6.0.0
```

Expected: `apps/api/package.json` and `pnpm-lock.yaml` include `redis`.

- [x] **Step 2: Write failing store behavior tests**

Create `apps/api/src/modules/auth/code-store.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { InMemoryVerificationCodeStore } from './code-store.js'

describe('InMemoryVerificationCodeStore', () => {
  it('enforces resend cooldown and consumes a valid code', async () => {
    const store = new InMemoryVerificationCodeStore()
    const now = new Date('2026-06-12T00:00:00.000Z')

    expect(await store.issue('a@example.com', 'hash', now)).toBe('issued')
    expect(await store.issue('a@example.com', 'hash', now)).toBe(
      'rate_limited',
    )
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
```

- [x] **Step 3: Run the memory store test and verify RED**

Run:

```bash
pnpm --filter @wordscodex/api test -- code-store.test.ts
```

Expected: FAIL because `InMemoryVerificationCodeStore` does not exist.

- [x] **Step 4: Implement the store contract and memory store**

Create `apps/api/src/modules/auth/code-store.ts`:

```ts
export type IssueCodeResult = 'issued' | 'rate_limited'
export type VerifyCodeResult =
  | 'valid'
  | 'invalid'
  | 'attempts_exceeded'

export interface VerificationCodeStore {
  issue(
    email: string,
    codeHash: string,
    now: Date,
  ): Promise<IssueCodeResult>
  verify(
    email: string,
    codeHash: string,
    now: Date,
  ): Promise<VerifyCodeResult>
}

type Record = {
  codeHash: string
  expiresAtMs: number
  resendAfterMs: number
  attempts: number
  consumed: boolean
}

export class InMemoryVerificationCodeStore
  implements VerificationCodeStore
{
  private readonly records = new Map<string, Record>()

  async issue(email: string, codeHash: string, now: Date) {
    const current = this.records.get(email)
    if (current && current.resendAfterMs > now.getTime()) {
      return 'rate_limited' as const
    }
    this.records.set(email, {
      codeHash,
      expiresAtMs: now.getTime() + 10 * 60 * 1000,
      resendAfterMs: now.getTime() + 60 * 1000,
      attempts: 0,
      consumed: false,
    })
    return 'issued' as const
  }

  async verify(email: string, codeHash: string, now: Date) {
    const record = this.records.get(email)
    if (!record || record.consumed) return 'invalid' as const
    if (record.expiresAtMs <= now.getTime()) return 'invalid' as const
    if (record.attempts >= 5) return 'attempts_exceeded' as const

    if (record.codeHash !== codeHash) {
      record.attempts += 1
      return record.attempts >= 5
        ? ('attempts_exceeded' as const)
        : ('invalid' as const)
    }

    record.consumed = true
    return 'valid' as const
  }
}
```

- [x] **Step 5: Run the memory store test and verify GREEN**

Run:

```bash
pnpm --filter @wordscodex/api test -- code-store.test.ts
```

Expected: two tests pass.

- [x] **Step 6: Implement Redis parity and integration coverage**

Create `apps/api/src/modules/auth/redis-code-store.ts`:

```ts
import { createHash } from 'node:crypto'
import type { RedisClientType } from 'redis'
import type {
  VerificationCodeStore,
  VerifyCodeResult,
} from './code-store.js'

const verifyScript = `
local codeHash = redis.call('HGET', KEYS[1], 'codeHash')
if not codeHash then
  return -1
end

local attempts = tonumber(redis.call('HGET', KEYS[1], 'attempts') or '0')
if attempts >= tonumber(ARGV[2]) then
  return -2
end

if codeHash ~= ARGV[1] then
  attempts = redis.call('HINCRBY', KEYS[1], 'attempts', 1)
  if attempts >= tonumber(ARGV[2]) then
    return -2
  end
  return 0
end

redis.call('DEL', KEYS[1])
return 1
`

function emailDigest(email: string) {
  return createHash('sha256').update(email).digest('hex')
}

export class RedisVerificationCodeStore
  implements VerificationCodeStore
{
  constructor(private readonly redis: RedisClientType) {}

  async issue(email: string, codeHash: string) {
    const digest = emailDigest(email)
    const cooldownKey = `auth:code-cooldown:${digest}`
    const codeKey = `auth:code:${digest}`
    const cooldown = await this.redis.set(cooldownKey, '1', {
      EX: 60,
      NX: true,
    })

    if (cooldown !== 'OK') return 'rate_limited' as const

    await this.redis
      .multi()
      .hSet(codeKey, {
        codeHash,
        attempts: '0',
      })
      .expire(codeKey, 600)
      .exec()
    return 'issued' as const
  }

  async verify(
    email: string,
    codeHash: string,
  ): Promise<VerifyCodeResult> {
    const result = await this.redis.eval(verifyScript, {
      keys: [`auth:code:${emailDigest(email)}`],
      arguments: [codeHash, '5'],
    })

    if (result === 1) return 'valid'
    if (result === -2) return 'attempts_exceeded'
    return 'invalid'
  }
}
```

The Lua script makes checking and consuming a code one atomic Redis operation. Raw
email and raw code never appear in Redis keys or values.

Create `apps/api/src/modules/auth/redis-code-store.test.ts` and run the same issue,
cooldown, consume, expiry-as-invalid, and five-attempt assertions against a dedicated
Redis database selected through `REDIS_URL`.

Run:

```bash
REDIS_URL=redis://127.0.0.1:6379/15 \
  pnpm --filter @wordscodex/api test -- redis-code-store.test.ts
```

Expected: Redis integration tests pass and database 15 is cleared after the test.

- [x] **Step 7: Commit**

```bash
git add apps/api/package.json apps/api/src/modules/auth pnpm-lock.yaml
git commit -m "feat: add verification code stores"
```

## Task 4: Implement Token And Authentication Services

**Files:**
- Modify: `apps/api/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/api/src/env.ts`
- Create: `apps/api/src/modules/auth/token-service.ts`
- Create: `apps/api/src/modules/auth/token-service.test.ts`
- Create: `apps/api/src/modules/auth/auth-service.ts`
- Create: `apps/api/src/modules/auth/auth-service.test.ts`

- [ ] **Step 1: Install JOSE**

Run:

```bash
pnpm --filter @wordscodex/api add jose@6.2.3
```

- [ ] **Step 2: Write failing token tests**

Create `apps/api/src/modules/auth/token-service.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { TokenService } from './token-service.js'

describe('TokenService', () => {
  const service = new TokenService(
    'test-secret-at-least-thirty-two-characters',
  )

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
```

- [ ] **Step 3: Run token tests and verify RED**

Run:

```bash
pnpm --filter @wordscodex/api test -- token-service.test.ts
```

Expected: FAIL because `TokenService` does not exist.

- [ ] **Step 4: Implement TokenService**

Create `apps/api/src/modules/auth/token-service.ts`:

```ts
import { createHash, randomBytes } from 'node:crypto'
import { SignJWT, jwtVerify } from 'jose'

export class TokenService {
  private readonly secret: Uint8Array

  constructor(secret: string) {
    this.secret = new TextEncoder().encode(secret)
  }

  async createAccessToken(userId: string) {
    return new SignJWT({ sub: userId })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(this.secret)
  }

  async verifyAccessToken(token: string) {
    const result = await jwtVerify(token, this.secret, {
      algorithms: ['HS256'],
    })
    if (!result.payload.sub) throw new Error('Access token has no subject')
    return { userId: result.payload.sub }
  }

  createRefreshToken() {
    return randomBytes(32).toString('base64url')
  }

  hashRefreshToken(token: string) {
    return createHash('sha256').update(token).digest('hex')
  }

  hashVerificationCode(email: string, code: string) {
    return createHash('sha256')
      .update(`${email}:${code}`)
      .digest('hex')
  }
}
```

- [ ] **Step 5: Write failing authentication service tests**

Create `apps/api/src/modules/auth/auth-service.test.ts` with in-memory repository and
code store fixtures. Cover these behaviors separately:

```ts
it('requests a code without revealing whether an account exists')
it('creates a registered user after a valid code')
it('upgrades an authenticated guest without changing its user id')
it('rejects a code after five invalid attempts')
it('creates a guest session')
it('rotates a refresh token and rejects replay')
it('revokes the current session during logout')
it('returns the current user for a valid access token')
```

Each test must assert the public `AuthSessionResponse` shape and stable service error
code, not internal repository calls.

- [ ] **Step 6: Run authentication service tests and verify RED**

Run:

```bash
pnpm --filter @wordscodex/api test -- auth-service.test.ts
```

Expected: FAIL because `AuthService` does not exist.

- [ ] **Step 7: Implement AuthService**

Create `apps/api/src/modules/auth/auth-service.ts` with these public methods:

```ts
requestCode(input: { email: string; now?: Date }): Promise<{
  accepted: true
  expiresInSeconds: 600
}>

verifyCode(input: {
  email: string
  code: string
  timezone: string
  guestAccessToken?: string
  now?: Date
}): Promise<{
  response: AuthSessionResponse
  refreshToken: string
}>

createGuest(input: {
  timezone: string
  now?: Date
}): Promise<{
  response: AuthSessionResponse
  refreshToken: string
}>

refresh(input: {
  refreshToken: string
  now?: Date
}): Promise<{
  response: AuthSessionResponse
  refreshToken: string
}>

logout(refreshToken: string | undefined): Promise<void>

getCurrentUser(accessToken: string): Promise<User>
```

Use these invariants:

- local/test verification code comes from `AUTH_DEV_CODE`;
- production code generation uses a cryptographically secure six-digit number and
  sends it through a `VerificationCodeSender` interface;
- access tokens expire in 900 seconds;
- refresh sessions expire after 30 days;
- refresh rotates through the repository's compare-and-update method;
- expired, revoked, missing, replayed, or malformed credentials map to
  `UNAUTHORIZED`;
- occupied email during guest upgrade maps to `ACCOUNT_EMAIL_IN_USE`;
- no returned object contains a refresh token except the internal route result.

- [ ] **Step 8: Extend and validate environment configuration**

Update `apps/api/src/env.ts` to parse:

```ts
NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
REDIS_URL: z.string().url().default('redis://127.0.0.1:6379'),
JWT_ACCESS_SECRET: z.string().min(32),
AUTH_DEV_CODE: z.string().regex(/^\d{6}$/).optional(),
```

Add a refinement rejecting `AUTH_DEV_CODE` when `NODE_ENV` is `production`.

- [ ] **Step 9: Run service tests and verify GREEN**

Run:

```bash
pnpm --filter @wordscodex/api test -- token-service.test.ts auth-service.test.ts
pnpm --filter @wordscodex/api typecheck
```

Expected: token and service tests pass and TypeScript exits 0.

- [ ] **Step 10: Commit**

```bash
git add apps/api/package.json apps/api/src/env.ts apps/api/src/modules/auth pnpm-lock.yaml
git commit -m "feat: add authentication services"
```

## Task 5: Expose Fastify Authentication APIs

**Files:**
- Modify: `apps/api/package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/src/modules/auth/auth-routes.ts`
- Create: `apps/api/src/modules/auth/auth-routes.test.ts`
- Create: `apps/api/src/shared/http-error.ts`

- [ ] **Step 1: Install Fastify cookie and rate-limit plugins**

Run:

```bash
pnpm --filter @wordscodex/api add \
  @fastify/cookie@11.0.2 \
  @fastify/rate-limit@11.0.0
```

- [ ] **Step 2: Write failing route tests**

Create `apps/api/src/modules/auth/auth-routes.test.ts`. Build the app with an in-memory
repository and code store, then verify:

```ts
it('returns 202 without exposing the verification code')
it('sets an HttpOnly refresh cookie after code verification')
it('creates a guest and sets the same cookie policy')
it('rotates the cookie during refresh')
it('clears the cookie during idempotent logout')
it('returns the current user with a Bearer access token')
it('returns the standard error payload for invalid input')
it('rejects repeated request-code calls with 429')
```

Cookie assertions must include `HttpOnly`, `SameSite=Lax`, `Path=/api/v1/auth`, and
absence of the refresh token from JSON.

- [ ] **Step 3: Run route tests and verify RED**

Run:

```bash
pnpm --filter @wordscodex/api test -- auth-routes.test.ts
```

Expected: FAIL because the auth routes are not registered.

- [ ] **Step 4: Implement standard HTTP errors**

Create `apps/api/src/shared/http-error.ts`:

```ts
import type { AuthErrorCode } from '@wordscodex/contracts'

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message)
  }
}
```

Map Zod failures to `VALIDATION_FAILED`, rate limits to
`AUTH_CODE_RATE_LIMITED`, service authentication failures to their stable code, and
all other failures to a generic internal response without stack or database details.

- [ ] **Step 5: Implement auth routes**

Create `apps/api/src/modules/auth/auth-routes.ts` and register:

```text
POST /auth/request-code
POST /auth/verify-code
POST /auth/guest
POST /auth/refresh
POST /auth/logout
GET  /me
```

Use shared schemas to parse every request and serialize every success response.
Set the refresh cookie with:

```ts
{
  httpOnly: true,
  sameSite: 'lax',
  secure: env.NODE_ENV === 'production',
  path: '/api/v1/auth',
  maxAge: 30 * 24 * 60 * 60,
}
```

Use the optional Bearer token on `verify-code` only for guest upgrade. `/me` requires
a Bearer token. Apply Fastify rate limits to request-code, verify-code, and guest.

- [ ] **Step 6: Wire dependencies through buildApp**

Change `buildApp()` to `buildApp(options?: BuildAppOptions)` where tests may inject an
`AuthService`. Production construction uses Prisma repository, Redis code store,
TokenService, and the configured verification-code sender.

Restrict CORS to `env.WEB_ORIGIN`:

```ts
void app.register(cors, {
  origin: env.WEB_ORIGIN,
  credentials: true,
})
```

Register cookie, rate limit, health, auth, and error handling in that order.

- [ ] **Step 7: Run route and API tests and verify GREEN**

Run:

```bash
pnpm --filter @wordscodex/api test
pnpm --filter @wordscodex/api typecheck
```

Expected: health and authentication API tests pass and TypeScript exits 0.

- [ ] **Step 8: Commit**

```bash
git add apps/api/package.json apps/api/src pnpm-lock.yaml
git commit -m "feat: expose authentication API"
```

## Task 6: Build The Mobile-First Web Login Flow

**Files:**
- Modify: `apps/web/src/app/App.tsx`
- Modify: `apps/web/src/app/App.test.tsx`
- Modify: `apps/web/src/app/providers.tsx`
- Create: `apps/web/src/app/router.tsx`
- Create: `apps/web/src/features/auth/api.ts`
- Create: `apps/web/src/features/auth/auth-store.ts`
- Create: `apps/web/src/features/auth/LoginPage.tsx`
- Create: `apps/web/src/features/auth/LoginPage.test.tsx`
- Create: `apps/web/src/features/auth/ProtectedRoute.tsx`
- Create: `apps/web/src/features/onboarding/OnboardingEntryPage.tsx`
- Modify: `apps/web/src/styles/index.css`

- [ ] **Step 1: Write failing login component tests**

Create `apps/web/src/features/auth/LoginPage.test.tsx` with a memory router and injected
auth API. Verify separately:

```ts
it('submits a valid email and displays the verification step')
it('associates an invalid email message with the email input')
it('verifies a six digit code and navigates to onboarding')
it('creates a guest and navigates to onboarding')
it('shows a Chinese API error and enables retry')
```

Use real React Hook Form and Zod behavior. Mock only the HTTP boundary.

- [ ] **Step 2: Update the shell test for the new login entry**

Change `apps/web/src/app/App.test.tsx` to expect the “开始学习” link to point to
`/login`, not `/onboarding`.

- [ ] **Step 3: Run Web tests and verify RED**

Run:

```bash
pnpm --filter @wordscodex/web test
```

Expected: FAIL because the login page, router, store, and `/login` entry do not exist.

- [ ] **Step 4: Implement the API client**

Create `apps/web/src/features/auth/api.ts`:

```ts
import {
  authSessionResponseSchema,
  errorResponseSchema,
  requestCodeResponseSchema,
  type AuthSessionResponse,
} from '@wordscodex/contracts'

const apiOrigin = import.meta.env.VITE_API_ORIGIN ?? 'http://localhost:3001'

async function request<T>(
  path: string,
  init: RequestInit,
  parse: (value: unknown) => T,
) {
  const response = await fetch(`${apiOrigin}/api/v1${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...init.headers,
    },
  })
  const body: unknown = response.status === 204 ? null : await response.json()
  if (!response.ok) {
    const error = errorResponseSchema.parse(body)
    throw new Error(error.error.message)
  }
  return parse(body)
}

export const authApi = {
  requestCode(email: string) {
    return request(
      '/auth/request-code',
      {
        method: 'POST',
        body: JSON.stringify({ email }),
      },
      (value) => requestCodeResponseSchema.parse(value),
    )
  },
  verifyCode(input: {
    email: string
    code: string
    timezone: string
    accessToken?: string
  }): Promise<AuthSessionResponse> {
    return request(
      '/auth/verify-code',
      {
        method: 'POST',
        body: JSON.stringify(input),
        headers: input.accessToken
          ? { authorization: `Bearer ${input.accessToken}` }
          : undefined,
      },
      (value) => authSessionResponseSchema.parse(value),
    )
  },
  guest(timezone: string) {
    return request(
      '/auth/guest',
      {
        method: 'POST',
        body: JSON.stringify({ timezone }),
      },
      (value) => authSessionResponseSchema.parse(value),
    )
  },
  refresh() {
    return request(
      '/auth/refresh',
      {
        method: 'POST',
      },
      (value) => authSessionResponseSchema.parse(value),
    )
  },
}
```

- [ ] **Step 5: Implement the in-memory auth store**

Create `apps/web/src/features/auth/auth-store.ts`:

```ts
import type { User } from '@wordscodex/contracts'
import { create } from 'zustand'

type AuthState = {
  accessToken: string | null
  user: User | null
  initialized: boolean
  setSession: (session: { accessToken: string; user: User }) => void
  clearSession: () => void
  finishInitialization: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  initialized: false,
  setSession: ({ accessToken, user }) =>
    set({
      accessToken,
      user,
      initialized: true,
    }),
  clearSession: () =>
    set({
      accessToken: null,
      user: null,
      initialized: true,
    }),
  finishInitialization: () => set({ initialized: true }),
}))
```

- [ ] **Step 6: Implement login, session restoration, and guarded routing**

Create `LoginPage.tsx` with two React Hook Form + Zod forms:

- email form posts `requestCode`;
- code form posts `verifyCode`;
- guest button posts `guest`;
- successful session calls `setSession` and navigates to `/onboarding`;
- each input has a `<label>`, `aria-describedby`, and inline Chinese error;
- pending actions disable their own submit button;
- API failures render `role="alert"`.

Create `ProtectedRoute.tsx`:

- while initialization is pending, show “正在恢复登录状态…”;
- if no user after initialization, redirect to `/login`;
- otherwise render `<Outlet />`.

Update providers so application startup calls `authApi.refresh()` once, stores the
session on success, and treats `UNAUTHORIZED` as signed out.

Create `apps/web/src/app/router.tsx` with:

```text
/             product entry
/login        LoginPage
/onboarding   ProtectedRoute -> OnboardingEntryPage
```

Change the product entry link to `/login`. `OnboardingEntryPage` displays the heading
“开始制定学习计划” and clearly states that the next step will select a goal and
vocabulary book.

- [ ] **Step 7: Add responsive login styles**

Extend `apps/web/src/styles/index.css` with:

- a centered authentication card capped at 480px;
- 48px minimum input and button height;
- visible `:focus-visible` outlines;
- full-width controls at 375px;
- code input using `inputmode="numeric"` and `autocomplete="one-time-code"`;
- no hover-only interaction;
- reduced-motion support.

- [ ] **Step 8: Run Web tests and verify GREEN**

Run:

```bash
pnpm --filter @wordscodex/web test
pnpm --filter @wordscodex/web typecheck
```

Expected: shell and login component tests pass and TypeScript exits 0.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src
git commit -m "feat: add web authentication flow"
```

## Task 7: Add Mobile Authentication End-To-End Tests

**Files:**
- Modify: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/auth.spec.ts`
- Modify: `apps/web/e2e/app-shell.spec.ts`

- [ ] **Step 1: Write failing browser tests**

Create `apps/web/e2e/auth.spec.ts` with two isolated tests:

```ts
test('logs in with an email verification code on mobile')
test('starts as a guest on mobile')
```

The Playwright web server must start both API and Web with test environment variables:

```text
NODE_ENV=test
AUTH_DEV_CODE=123456
JWT_ACCESS_SECRET=test-secret-at-least-thirty-two-characters
REDIS_URL=redis://127.0.0.1:6379/15
```

The email test requests a code, enters `123456`, reaches `/onboarding`, and sees
“开始制定学习计划”. The guest test clicks “先体验一下” and reaches the same guarded
page. Keep the Pixel 7 project.

- [ ] **Step 2: Run E2E and verify RED**

Run:

```bash
pnpm test:e2e
```

Expected: FAIL until Playwright starts the API, database fixtures are isolated, and
the browser flow is wired.

- [ ] **Step 3: Configure the combined test server**

Update `apps/web/playwright.config.ts` to use an array of web servers:

```ts
webServer: [
  {
    command: 'pnpm --filter @wordscodex/api start',
    port: 3001,
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: 'test',
      AUTH_DEV_CODE: '123456',
      JWT_ACCESS_SECRET: 'test-secret-at-least-thirty-two-characters',
    },
  },
  {
    command: 'pnpm build && pnpm preview --host 127.0.0.1',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
],
```

Forward `DATABASE_URL`, `REDIS_URL`, and `WEB_ORIGIN` from the parent environment.
Clear auth sessions, users, and Redis database 15 before the suite.

- [ ] **Step 4: Run E2E and verify GREEN**

Run:

```bash
pnpm test:e2e
```

Expected: app-shell, email verification, and guest mobile tests pass.

- [ ] **Step 5: Verify the page visually in the in-app Browser**

Start the app, open `/login` at a 375×812 viewport, and verify:

- no horizontal overflow;
- email input and submit action are visible together;
- controls are at least 44px high;
- verification and API error states remain readable;
- guest action is visually secondary but clearly discoverable.

- [ ] **Step 6: Commit**

```bash
git add apps/web/e2e apps/web/playwright.config.ts
git commit -m "test: cover mobile authentication flow"
```

## Task 8: Update CI, Environment, And Development Documentation

**Files:**
- Modify: `.env.example`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`
- Modify: `docs/DEVELOPMENT.md`
- Modify: `apps/api/package.json`
- Modify: `package.json`

- [ ] **Step 1: Add database deployment scripts**

Add to `apps/api/package.json`:

```json
"db:deploy": "prisma migrate deploy"
```

Add to the root `package.json`:

```json
"db:deploy": "pnpm --filter @wordscodex/api db:deploy"
```

- [ ] **Step 2: Update example environment**

Append to `.env.example`:

```dotenv
NODE_ENV=development
REDIS_URL=redis://127.0.0.1:6379
JWT_ACCESS_SECRET=replace-with-at-least-32-characters
AUTH_DEV_CODE=123456
```

Document that production must omit `AUTH_DEV_CODE` and provide a secret outside source
control.

- [ ] **Step 3: Add PostgreSQL and Redis CI services**

Update `.github/workflows/ci.yml` so the verify job contains:

```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: wordscodex
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
  redis:
    image: redis:7
    ports:
      - 6379:6379
    options: >-
      --health-cmd "redis-cli ping"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

Set job environment:

```yaml
DATABASE_URL: postgresql://postgres:postgres@localhost:5432/wordscodex
REDIS_URL: redis://127.0.0.1:6379/15
NODE_ENV: test
AUTH_DEV_CODE: 123456
JWT_ACCESS_SECRET: test-secret-at-least-thirty-two-characters
WEB_ORIGIN: http://127.0.0.1:4173
VITE_API_ORIGIN: http://127.0.0.1:3001
```

Run `pnpm db:deploy` before tests.

- [ ] **Step 4: Synchronize public development documentation**

Update `README.md` with:

- Redis 7+ requirement and local startup command;
- the four new environment variables;
- `pnpm db:deploy`;
- email dev code behavior;
- login URL and health URL;
- complete verification commands.

Update `docs/DEVELOPMENT.md`:

- add `accountType` and `updatedAt` to User;
- add AuthSession constraints;
- add `POST /api/v1/auth/guest`;
- state that email is the MVP verification channel;
- document access-token and refresh-cookie storage;
- document guest upgrade conflict behavior.

- [ ] **Step 5: Run full verification**

Run:

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:deploy
pnpm db:seed
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Expected:

- installation, generation, migration, and seed exit 0;
- contracts, code stores, tokens, services, repositories, routes, and Web tests pass;
- all packages type-check and build;
- all Pixel 7 browser tests pass;
- no secret, raw verification code, refresh token, or complete email appears in logs.

- [ ] **Step 6: Commit and push**

```bash
git add .env.example .github README.md docs/DEVELOPMENT.md apps/api/package.json package.json pnpm-lock.yaml
git commit -m "docs: verify authentication development flow"
git push origin codex/stage-1-auth
```

## Stage 1 Authentication Completion Gate

This authentication slice counts as complete only when:

- email verification and guest login work through API and Web;
- guest upgrade keeps the same user ID or returns `ACCOUNT_EMAIL_IN_USE`;
- refresh tokens are HttpOnly, hashed at rest, rotated, and revocable;
- access tokens are short-lived and never persisted by the Web app;
- verification codes expire, enforce cooldown, and lock after five failures;
- PostgreSQL and Redis integration tests pass;
- `/me` rejects missing or invalid credentials;
- mobile email and guest E2E flows pass;
- docs, environment examples, CI, migration, seed, and full verification are current.
