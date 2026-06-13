import { useEffect } from 'react'
import { analyticsEventQueuedEventName } from '../features/analytics/track-event'
import {
  flushAnalyticsEventQueue,
  type FlushAnalyticsEventQueueResult,
} from '../features/analytics/flush-analytics-events'
import { useAuthStore } from '../features/auth/auth-store'
import { studyApi, type StudyClient } from '../features/study/api'
import {
  offlineReviewQueueChangedEventName,
  offlineReviewQueue,
  type OfflineReviewQueueClient,
} from '../features/study/offline-review-queue'
import {
  offlineReviewSyncCompletedEventName,
  syncOfflineReviewQueue,
} from '../features/study/offline-review-sync'
import {
  analyticsFlushSyncTag,
  isWordscodexBackgroundSyncMessage,
  offlineReviewSyncTag,
  registerBackgroundSync,
  type BackgroundSyncRegistrationResult,
  type BackgroundSyncTag,
} from './background-sync'

type BrowserEventTarget = Pick<
  EventTarget,
  'addEventListener' | 'dispatchEvent' | 'removeEventListener'
>

type BackgroundSyncControllerProps = {
  eventTarget?: BrowserEventTarget | null
  isOnline?: () => boolean
  registerSync?: (
    tag: BackgroundSyncTag,
  ) => Promise<BackgroundSyncRegistrationResult>
  flushAnalytics?: (input: {
    accessToken?: string
  }) => Promise<FlushAnalyticsEventQueueResult>
  reviewQueue?: OfflineReviewQueueClient
  studyApi?: StudyClient
}

export function BackgroundSyncController({
  eventTarget = getDefaultEventTarget(),
  isOnline = getDefaultOnlineStatus,
  registerSync = registerBackgroundSync,
  flushAnalytics = (input) => flushAnalyticsEventQueue(input),
  reviewQueue = offlineReviewQueue,
  studyApi: client = studyApi,
}: BackgroundSyncControllerProps) {
  const accessToken = useAuthStore((state) => state.accessToken)

  useEffect(() => {
    if (!eventTarget) return

    const registerAnalyticsSync = () => {
      void registerSync(analyticsFlushSyncTag)
    }
    const registerReviewSync = () => {
      if (!accessToken) return
      void registerSync(offlineReviewSyncTag)
    }
    const flushQueuedAnalytics = () => {
      if (!isOnline()) return
      void flushAnalytics({
        ...(accessToken ? { accessToken } : {}),
      }).then((result) => {
        if (result.status === 'failed') {
          registerAnalyticsSync()
        }
      })
    }
    const syncQueuedReviews = () => {
      if (!accessToken || !isOnline()) return

      void syncOfflineReviewQueue({
        queue: reviewQueue,
        studyApi: client,
        accessToken,
      }).then((result) => {
        if (result.status === 'synced' && result.syncedCount > 0) {
          eventTarget.dispatchEvent(
            new CustomEvent(offlineReviewSyncCompletedEventName, {
              detail: {
                syncedCount: result.syncedCount,
              },
            }),
          )
        }
        if (result.status === 'failed') {
          registerReviewSync()
        }
      })
    }
    const handleOnline = () => {
      registerAnalyticsSync()
      registerReviewSync()
      flushQueuedAnalytics()
    }
    const handleMessage = (event: Event) => {
      const data: unknown = (event as MessageEvent<unknown>).data
      if (!isWordscodexBackgroundSyncMessage(data)) return

      if (data.tag === analyticsFlushSyncTag) {
        flushQueuedAnalytics()
      }
      if (data.tag === offlineReviewSyncTag) {
        syncQueuedReviews()
      }
    }

    registerAnalyticsSync()
    registerReviewSync()
    flushQueuedAnalytics()

    eventTarget.addEventListener('online', handleOnline)
    eventTarget.addEventListener(
      analyticsEventQueuedEventName,
      registerAnalyticsSync,
    )
    eventTarget.addEventListener(
      offlineReviewQueueChangedEventName,
      registerReviewSync,
    )
    eventTarget.addEventListener('message', handleMessage)

    return () => {
      eventTarget.removeEventListener('online', handleOnline)
      eventTarget.removeEventListener(
        analyticsEventQueuedEventName,
        registerAnalyticsSync,
      )
      eventTarget.removeEventListener(
        offlineReviewQueueChangedEventName,
        registerReviewSync,
      )
      eventTarget.removeEventListener('message', handleMessage)
    }
  }, [
    accessToken,
    client,
    eventTarget,
    flushAnalytics,
    isOnline,
    registerSync,
    reviewQueue,
  ])

  return null
}

function getDefaultEventTarget(): BrowserEventTarget | null {
  return typeof window === 'undefined' ? null : window
}

function getDefaultOnlineStatus() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}
