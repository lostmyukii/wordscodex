import { createHash } from 'node:crypto'
import type { RedisClientType } from 'redis'
import type { VerificationCodeStore, VerifyCodeResult } from './code-store.js'

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

export class RedisVerificationCodeStore implements VerificationCodeStore {
  constructor(private readonly redis: RedisClientType) {}

  async issue(email: string, codeHash: string, now: Date) {
    void now
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
    now: Date,
  ): Promise<VerifyCodeResult> {
    void now
    const result = await this.redis.eval(verifyScript, {
      keys: [`auth:code:${emailDigest(email)}`],
      arguments: [codeHash, '5'],
    })

    if (result === 1) return 'valid'
    if (result === -2) return 'attempts_exceeded'
    return 'invalid'
  }
}
