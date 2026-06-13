export const offlineDatabaseName = 'wordscodex-offline'

export const offlineDatabaseStores = {
  studySessions: 'sessionId, cachedAt, expiresAt',
  pendingReviews:
    'idempotencyKey, sessionId, wordId, createdAt, retryCount, lastAttemptAt',
  analyticsEvents: 'clientEventId, name, occurredAt, retryCount, lastAttemptAt',
} as const
