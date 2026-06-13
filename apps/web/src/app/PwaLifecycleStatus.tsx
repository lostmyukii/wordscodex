import { useEffect, useRef, useState } from 'react'
import {
  trackEvent as defaultTrackEvent,
  type TrackAnalyticsEvent,
} from '../features/analytics/track-event'

type InstallOutcome = {
  outcome: 'accepted' | 'dismissed'
  platform: string
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<InstallOutcome>
}

type BrowserEventTarget = Pick<
  EventTarget,
  'addEventListener' | 'removeEventListener'
>

type ServiceWorkerUpdateState = {
  updateReady: boolean
  applyUpdate: () => Promise<void>
}

type PwaLifecycleStatusProps = {
  eventTarget?: BrowserEventTarget | null
  serviceWorkerUpdate?: ServiceWorkerUpdateState
  trackEvent?: TrackAnalyticsEvent
}

export function PwaLifecycleStatus({
  eventTarget = getDefaultEventTarget(),
  serviceWorkerUpdate,
  trackEvent = defaultTrackEvent,
}: PwaLifecycleStatusProps) {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalling, setIsInstalling] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const trackedUpdateReady = useRef(false)

  useEffect(() => {
    if (!eventTarget) return

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
      void trackEvent({
        name: 'pwa_install_prompt_shown',
        properties: {
          source: 'beforeinstallprompt',
        },
      }).catch(() => undefined)
    }

    eventTarget.addEventListener(
      'beforeinstallprompt',
      handleBeforeInstallPrompt,
    )

    return () => {
      eventTarget.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      )
    }
  }, [eventTarget, trackEvent])

  const updateReady = serviceWorkerUpdate?.updateReady ?? false

  useEffect(() => {
    if (!updateReady) {
      trackedUpdateReady.current = false
      return
    }
    if (trackedUpdateReady.current) return

    trackedUpdateReady.current = true
    void trackEvent({
      name: 'pwa_update_ready',
      properties: {},
    }).catch(() => undefined)
  }, [trackEvent, updateReady])

  if (!installEvent && !updateReady) return null

  const installApp = async () => {
    if (!installEvent || isInstalling) return

    setIsInstalling(true)
    try {
      await installEvent.prompt()
      const choice = await installEvent.userChoice
      if (choice.outcome === 'accepted') {
        await trackEvent({
          name: 'pwa_installed',
          properties: {
            outcome: choice.outcome,
            platform: choice.platform,
          },
        }).catch(() => undefined)
      }
      setInstallEvent(null)
    } finally {
      setIsInstalling(false)
    }
  }

  const applyUpdate = async () => {
    if (!serviceWorkerUpdate || isUpdating) return

    setIsUpdating(true)
    try {
      await serviceWorkerUpdate.applyUpdate()
      await trackEvent({
        name: 'pwa_update_applied',
        properties: {},
      }).catch(() => undefined)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <aside className="pwa-status" aria-label="PWA 状态提示">
      {updateReady ? (
        <section>
          <strong>发现新版本</strong>
          <p>更新后可使用最新的离线学习体验。</p>
          <button
            className="secondary-action"
            type="button"
            onClick={() => {
              void applyUpdate()
            }}
            disabled={isUpdating}
          >
            {isUpdating ? '正在更新…' : '立即更新'}
          </button>
        </section>
      ) : null}

      {installEvent ? (
        <section>
          <strong>可安装为应用</strong>
          <p>安装到桌面后，学习入口更快，也更适合离线继续。</p>
          <button
            className="secondary-action"
            type="button"
            onClick={() => {
              void installApp()
            }}
            disabled={isInstalling}
          >
            {isInstalling ? '正在安装…' : '安装到桌面'}
          </button>
        </section>
      ) : null}
    </aside>
  )
}

function getDefaultEventTarget(): BrowserEventTarget | null {
  return typeof window === 'undefined' ? null : window
}
