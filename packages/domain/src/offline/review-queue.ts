export type OfflineReviewOperation = {
  idempotencyKey: string
  sessionId: string
  wordId: string
  createdAt: string
  retryCount: number
  lastError: string | null
  lastAttemptAt: string | null
}

export function upsertOfflineReviewOperation(input: {
  queue: OfflineReviewOperation[]
  operation: OfflineReviewOperation
}) {
  const existing = input.queue.find(
    (item) => item.idempotencyKey === input.operation.idempotencyKey,
  )
  if (!existing) {
    return [...input.queue, input.operation]
  }

  return input.queue.map((item) =>
    item.idempotencyKey === input.operation.idempotencyKey
      ? {
          ...item,
          sessionId: input.operation.sessionId,
          wordId: input.operation.wordId,
          retryCount: input.operation.retryCount,
          lastError: input.operation.lastError,
          lastAttemptAt: input.operation.lastAttemptAt,
        }
      : item,
  )
}

export function selectPendingOfflineReviewOperations(input: {
  queue: OfflineReviewOperation[]
  limit: number
}) {
  return [...input.queue]
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
    .slice(0, Math.max(0, input.limit))
}

export function markOfflineReviewOperationFailed(input: {
  operation: OfflineReviewOperation
  errorMessage: string
  attemptedAt: string
}) {
  return {
    ...input.operation,
    retryCount: input.operation.retryCount + 1,
    lastError: input.errorMessage,
    lastAttemptAt: input.attemptedAt,
  }
}

export function isOfflineReviewOperationReady(input: {
  operation: OfflineReviewOperation
  now: string
  baseDelayMs?: number
  maxDelayMs?: number
}) {
  if (!input.operation.lastAttemptAt) return true

  const baseDelayMs = input.baseDelayMs ?? 60_000
  const maxDelayMs = input.maxDelayMs ?? 30 * 60_000
  const retryExponent = Math.max(0, input.operation.retryCount - 1)
  const retryDelayMs = Math.min(maxDelayMs, baseDelayMs * 2 ** retryExponent)
  const nextAttemptAtMs =
    new Date(input.operation.lastAttemptAt).getTime() + retryDelayMs

  return new Date(input.now).getTime() >= nextAttemptAtMs
}
