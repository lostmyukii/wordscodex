import type { AuthErrorCode } from '@wordscodex/contracts'

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}
