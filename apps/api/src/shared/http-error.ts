import type { ApiErrorCode } from '@wordscodex/contracts'

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}
