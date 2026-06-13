import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '../auth/auth-store'
import { studyApi, type StudyClient } from './api'
import {
  offlineReviewQueueChangedEventName,
  offlineReviewQueue,
  type OfflineReviewQueueClient,
  type OfflineReviewQueueSummary,
} from './offline-review-queue'
import {
  offlineReviewSyncCompletedEventName,
  syncOfflineReviewQueue,
  type OfflineReviewSyncResult,
} from './offline-review-sync'

type BrowserEventTarget = Pick<
  EventTarget,
  'addEventListener' | 'dispatchEvent' | 'removeEventListener'
>

type OfflineSyncCenterProps = {
  queue?: OfflineReviewQueueClient
  studyApi?: StudyClient
  eventTarget?: BrowserEventTarget | null
  isOnline?: () => boolean
}

export function OfflineSyncCenter({
  queue = offlineReviewQueue,
  studyApi: client = studyApi,
  eventTarget = getDefaultEventTarget(),
  isOnline = getDefaultOnlineStatus,
}: OfflineSyncCenterProps) {
  const accessToken = useAuthStore((state) => state.accessToken)
  const [summary, setSummary] = useState<OfflineReviewQueueSummary | null>(null)
  const [result, setResult] = useState<OfflineReviewSyncResult | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  const refreshSummary = useCallback(() => {
    void queue.getSummary().then(setSummary)
  }, [queue])

  useEffect(() => {
    if (!eventTarget) {
      refreshSummary()
      return
    }

    refreshSummary()
    eventTarget.addEventListener('online', refreshSummary)
    eventTarget.addEventListener(
      offlineReviewQueueChangedEventName,
      refreshSummary,
    )
    eventTarget.addEventListener(
      offlineReviewSyncCompletedEventName,
      refreshSummary,
    )

    return () => {
      eventTarget.removeEventListener('online', refreshSummary)
      eventTarget.removeEventListener(
        offlineReviewQueueChangedEventName,
        refreshSummary,
      )
      eventTarget.removeEventListener(
        offlineReviewSyncCompletedEventName,
        refreshSummary,
      )
    }
  }, [eventTarget, refreshSummary])

  if (!summary || summary.pendingCount === 0) return null

  const syncNow = async () => {
    if (!accessToken || !isOnline() || isSyncing) return

    setIsSyncing(true)
    try {
      const nextResult = await syncOfflineReviewQueue({
        queue,
        studyApi: client,
        accessToken,
      })
      setResult(nextResult)
      if (nextResult.status === 'synced' && nextResult.syncedCount > 0) {
        eventTarget?.dispatchEvent(
          new CustomEvent(offlineReviewSyncCompletedEventName, {
            detail: {
              syncedCount: nextResult.syncedCount,
            },
          }),
        )
      }
      refreshSummary()
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <aside className="sync-center" aria-label="离线同步中心">
      <strong>离线同步中心</strong>
      <p>待同步 {summary.pendingCount} 条作答</p>
      <p>可立即同步 {summary.readyCount} 条</p>
      {summary.nextRetryAt ? <p>下次自动重试 {summary.nextRetryAt}</p> : null}
      {summary.lastError ? <p>上次错误：{summary.lastError}</p> : null}
      {result?.status === 'synced' && result.syncedCount > 0 ? (
        <p>已同步 {result.syncedCount} 条离线作答</p>
      ) : null}
      <button
        className="secondary-action"
        type="button"
        onClick={() => void syncNow()}
        disabled={!accessToken || !isOnline() || isSyncing}
      >
        {isSyncing ? '正在同步…' : '立即同步'}
      </button>
    </aside>
  )
}

function getDefaultEventTarget(): BrowserEventTarget | null {
  return typeof window === 'undefined' ? null : window
}

function getDefaultOnlineStatus() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}
