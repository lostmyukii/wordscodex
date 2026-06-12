export type IssueCodeResult = 'issued' | 'rate_limited'
export type VerifyCodeResult = 'valid' | 'invalid' | 'attempts_exceeded'

export interface VerificationCodeStore {
  issue(email: string, codeHash: string, now: Date): Promise<IssueCodeResult>
  verify(email: string, codeHash: string, now: Date): Promise<VerifyCodeResult>
}

type CodeRecord = {
  codeHash: string
  expiresAtMs: number
  resendAfterMs: number
  attempts: number
  consumed: boolean
}

export class InMemoryVerificationCodeStore implements VerificationCodeStore {
  private readonly records = new Map<string, CodeRecord>()

  issue(email: string, codeHash: string, now: Date): Promise<IssueCodeResult> {
    const current = this.records.get(email)
    if (current && current.resendAfterMs > now.getTime()) {
      return Promise.resolve('rate_limited')
    }
    this.records.set(email, {
      codeHash,
      expiresAtMs: now.getTime() + 10 * 60 * 1000,
      resendAfterMs: now.getTime() + 60 * 1000,
      attempts: 0,
      consumed: false,
    })
    return Promise.resolve('issued')
  }

  verify(
    email: string,
    codeHash: string,
    now: Date,
  ): Promise<VerifyCodeResult> {
    const record = this.records.get(email)
    if (!record || record.consumed) return Promise.resolve('invalid')
    if (record.expiresAtMs <= now.getTime()) return Promise.resolve('invalid')
    if (record.attempts >= 5) return Promise.resolve('attempts_exceeded')

    if (record.codeHash !== codeHash) {
      record.attempts += 1
      return Promise.resolve(
        record.attempts >= 5 ? 'attempts_exceeded' : 'invalid',
      )
    }

    record.consumed = true
    return Promise.resolve('valid')
  }
}
