import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PwaLifecycleStatus } from './PwaLifecycleStatus'

type InstallOutcome = {
  outcome: 'accepted' | 'dismissed'
  platform: string
}

type BeforeInstallPromptTestEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<InstallOutcome>
}

describe('PwaLifecycleStatus', () => {
  let eventTarget: EventTarget

  beforeEach(() => {
    eventTarget = new EventTarget()
  })

  it('shows an install action when the browser exposes beforeinstallprompt', async () => {
    const prompt = vi.fn(() => Promise.resolve())
    const trackEvent = vi.fn().mockResolvedValue(undefined)
    const installEvent = createBeforeInstallPromptEvent({
      prompt,
      userChoice: Promise.resolve({
        outcome: 'accepted',
        platform: 'web',
      }),
    })

    render(
      <PwaLifecycleStatus eventTarget={eventTarget} trackEvent={trackEvent} />,
    )

    eventTarget.dispatchEvent(installEvent)

    const installButton = await screen.findByRole('button', {
      name: '安装到桌面',
    })
    expect(installEvent.defaultPrevented).toBe(true)
    await waitFor(() =>
      expect(trackEvent).toHaveBeenCalledWith({
        name: 'pwa_install_prompt_shown',
        properties: {
          source: 'beforeinstallprompt',
        },
      }),
    )

    fireEvent.click(installButton)

    await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(trackEvent).toHaveBeenCalledWith({
        name: 'pwa_installed',
        properties: {
          outcome: 'accepted',
          platform: 'web',
        },
      }),
    )
    await waitFor(() => expect(installButton).not.toBeInTheDocument())
  })

  it('shows an update action when a service worker update is ready', async () => {
    const applyUpdate = vi.fn(() => Promise.resolve())
    const trackEvent = vi.fn().mockResolvedValue(undefined)

    render(
      <PwaLifecycleStatus
        eventTarget={eventTarget}
        trackEvent={trackEvent}
        serviceWorkerUpdate={{
          applyUpdate,
          updateReady: true,
        }}
      />,
    )

    expect(screen.getByText('发现新版本')).toBeInTheDocument()
    await waitFor(() =>
      expect(trackEvent).toHaveBeenCalledWith({
        name: 'pwa_update_ready',
        properties: {},
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: '立即更新' }))

    await waitFor(() => expect(applyUpdate).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(trackEvent).toHaveBeenCalledWith({
        name: 'pwa_update_applied',
        properties: {},
      }),
    )
  })
})

function createBeforeInstallPromptEvent(input: {
  prompt: () => Promise<void>
  userChoice: Promise<InstallOutcome>
}): BeforeInstallPromptTestEvent {
  const event = new Event('beforeinstallprompt', {
    cancelable: true,
  }) as BeforeInstallPromptTestEvent

  event.prompt = input.prompt
  event.userChoice = input.userChoice

  return event
}
