import { useEffect, useRef, useState } from 'react'
import {
  trackAnalyticsEvent,
  type TrackAnalyticsEvent,
} from '../analytics/track-event'
import { useAuthStore } from '../auth/auth-store'
import { studyApi, type StudyClient } from './api'
import {
  offlineReviewQueue,
  type OfflineReviewQueueClient,
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

type OfflineReviewSyncStatusProps = {
  queue?: OfflineReviewQueueClient
  studyApi?: StudyClient
  eventTarget?: BrowserEventTarget | null
  isOnline?: () => boolean
  trackEvent?: TrackAnalyticsEvent
}

export function OfflineReviewSyncStatus({
  queue = offlineReviewQueue,
  studyApi: client = studyApi,
  eventTarget = getDefaultEventTarget(),
  isOnline = getDefaultOnlineStatus,
  trackEvent,
}: OfflineReviewSyncStatusProps) {
  const accessToken = useAuthStore((state) => state.accessToken)
  const blockedAccessToken = useRef<string | null>(null)
  const [result, setResult] = useState<OfflineReviewSyncResult | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    if (blockedAccessToken.current !== accessToken) {
      blockedAccessToken.current = null
    }
  }, [accessToken])

  useEffect(() => {
    if (!eventTarget) return
    const sendTrackEvent =
      trackEvent ??
      ((input) =>
        trackAnalyticsEvent({
          ...input,
          ...(accessToken ? { accessToken } : {}),
        }).then(() => undefined))

    const sync = () => {
      if (!accessToken || !isOnline()) return
      if (blockedAccessToken.current === accessToken) return

      setIsSyncing(true)
      void syncOfflineReviewQueue({
        queue,
        studyApi: client,
        accessToken,
      })
        .then((nextResult) => {
          setResult(nextResult)
          if (nextResult.status === 'synced' && nextResult.syncedCount > 0) {
            void sendTrackEvent({
              name: 'offline_queue_synced',
              properties: {
                syncedCount: nextResult.syncedCount,
                failedCount: nextResult.failedCount,
              },
            }).catch(() => undefined)
            eventTarget.dispatchEvent(
              new CustomEvent(offlineReviewSyncCompletedEventName, {
                detail: {
                  syncedCount: nextResult.syncedCount,
                },
              }),
            )
          }
          if (nextResult.status === 'auth_required') {
            blockedAccessToken.current = accessToken
          }
        })
        .finally(() => {
          setIsSyncing(false)
        })
    }

    sync()
    eventTarget.addEventListener('online', sync)

    return () => {
      eventTarget.removeEventListener('online', sync)
    }
  }, [accessToken, client, eventTarget, isOnline, queue, trackEvent])

  if (isSyncing) {
    return (
      <div className="sync-status" role="status">
        正在同步离线作答…
      </div>
    )
  }

  if (!result || result.status === 'idle') return null

  if (result.status === 'synced') {
    return (
      <div className="sync-status success" role="status">
        已自动同步 {result.syncedCount} 条离线作答
      </div>
    )
  }

  if (result.status === 'auth_required') {
    return (
      <div className="sync-status warning" role="status">
        登录状态已失效，离线作答已暂停同步，请重新登录。
      </div>
    )
  }

  return (
    <div className="sync-status warning" role="status">
      离线作答自动同步失败：{result.lastError}
    </div>
  )
}

function getDefaultEventTarget(): BrowserEventTarget | null {
  return typeof window === 'undefined' ? null : window
}

function getDefaultOnlineStatus() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}
