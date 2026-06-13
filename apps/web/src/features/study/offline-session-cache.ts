import Dexie, { type Table } from 'dexie'
import type { StudySessionResponse } from '@wordscodex/contracts'
import {
  offlineDatabaseName,
  offlineDatabaseStores,
} from './offline-database-schema'

type CachedStudySessionRecord = {
  sessionId: string
  response: StudySessionResponse
  cachedAt: string
  expiresAt: string
}

type StudySessionCacheOptions = {
  databaseName?: string
  ttlDays?: number
  now?: () => Date
}

export type StudySessionCacheClient = {
  save(response: StudySessionResponse): Promise<void>
  load(sessionId: string): Promise<StudySessionResponse | null>
  delete(sessionId: string): Promise<void>
  clearExpired(): Promise<void>
}

class StudySessionCacheDatabase extends Dexie {
  studySessions!: Table<CachedStudySessionRecord, string>

  constructor(databaseName: string) {
    super(databaseName)
    this.version(1).stores(offlineDatabaseStores)
    this.version(2).stores(offlineDatabaseStores)
    this.version(3).stores(offlineDatabaseStores)
  }
}

const defaultTtlDays = 7

export class StudySessionCache implements StudySessionCacheClient {
  private readonly database: StudySessionCacheDatabase
  private readonly ttlDays: number
  private readonly now: () => Date

  constructor(options: StudySessionCacheOptions = {}) {
    this.database = new StudySessionCacheDatabase(
      options.databaseName ?? offlineDatabaseName,
    )
    this.ttlDays = options.ttlDays ?? defaultTtlDays
    this.now = options.now ?? (() => new Date())
  }

  async save(response: StudySessionResponse, cachedAt = this.now()) {
    const expiresAt = addDays(cachedAt, this.ttlDays)

    await this.database.studySessions.put({
      sessionId: response.session.id,
      response,
      cachedAt: cachedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    })
  }

  async load(sessionId: string): Promise<StudySessionResponse | null> {
    const record = await this.database.studySessions.get(sessionId)
    if (!record) return null

    if (new Date(record.expiresAt).getTime() <= this.now().getTime()) {
      await this.database.studySessions.delete(sessionId)
      return null
    }

    return record.response
  }

  async delete(sessionId: string) {
    await this.database.studySessions.delete(sessionId)
  }

  async clearExpired() {
    const nowMs = this.now().getTime()
    const records = await this.database.studySessions.toArray()
    const expiredSessionIds = records
      .filter((record) => new Date(record.expiresAt).getTime() <= nowMs)
      .map((record) => record.sessionId)

    await this.database.studySessions.bulkDelete(expiredSessionIds)
  }
}

export const studySessionCache = new StudySessionCache()

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}
