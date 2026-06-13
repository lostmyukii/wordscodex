export const analyticsFlushSyncTag = 'wordscodex-analytics-flush'
export const offlineReviewSyncTag = 'wordscodex-offline-review-sync'
export const backgroundSyncMessageType = 'WORDSCODEX_BACKGROUND_SYNC'

export type BackgroundSyncTag =
  | typeof analyticsFlushSyncTag
  | typeof offlineReviewSyncTag

export type BackgroundSyncRegistrationResult = {
  status: 'registered' | 'unsupported' | 'failed'
  tag: BackgroundSyncTag
  lastError?: string
}

type SyncManagerLike = {
  register(tag: string): Promise<void>
}

type ServiceWorkerRegistrationWithSync = {
  sync?: SyncManagerLike
}

export type ServiceWorkerContainerLike = {
  ready: Promise<ServiceWorkerRegistrationWithSync>
}

type RegisterBackgroundSyncOptions = {
  serviceWorker?: ServiceWorkerContainerLike | null
}

export type WordscodexBackgroundSyncMessage = {
  type: typeof backgroundSyncMessageType
  tag: BackgroundSyncTag
}

export async function registerBackgroundSync(
  tag: BackgroundSyncTag,
  options: RegisterBackgroundSyncOptions = {},
): Promise<BackgroundSyncRegistrationResult> {
  const serviceWorker = options.serviceWorker ?? getDefaultServiceWorker()
  if (!serviceWorker) {
    return {
      status: 'unsupported',
      tag,
    }
  }

  try {
    const registration = await serviceWorker.ready
    if (!registration.sync) {
      return {
        status: 'unsupported',
        tag,
      }
    }

    await registration.sync.register(tag)

    return {
      status: 'registered',
      tag,
    }
  } catch (error) {
    return {
      status: 'failed',
      tag,
      lastError: error instanceof Error ? error.message : '后台同步注册失败。',
    }
  }
}

export function isWordscodexBackgroundSyncMessage(
  data: unknown,
): data is WordscodexBackgroundSyncMessage {
  if (!data || typeof data !== 'object') return false
  const message = data as { type?: unknown; tag?: unknown }

  return (
    message.type === backgroundSyncMessageType &&
    (message.tag === analyticsFlushSyncTag ||
      message.tag === offlineReviewSyncTag)
  )
}

function getDefaultServiceWorker(): ServiceWorkerContainerLike | null {
  if (typeof navigator === 'undefined') return null
  if (!('serviceWorker' in navigator)) return null

  return navigator.serviceWorker as unknown as ServiceWorkerContainerLike
}
