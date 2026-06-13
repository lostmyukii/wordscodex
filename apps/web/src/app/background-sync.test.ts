import { describe, expect, it, vi } from 'vitest'
import {
  analyticsFlushSyncTag,
  backgroundSyncMessageType,
  isWordscodexBackgroundSyncMessage,
  offlineReviewSyncTag,
  registerBackgroundSync,
} from './background-sync'

describe('background sync helpers', () => {
  it('registers a supported sync tag through the service worker registration', async () => {
    const register = vi.fn().mockResolvedValue(undefined)

    await expect(
      registerBackgroundSync(analyticsFlushSyncTag, {
        serviceWorker: {
          ready: Promise.resolve({
            sync: {
              register,
            },
          }),
        },
      }),
    ).resolves.toEqual({
      status: 'registered',
      tag: analyticsFlushSyncTag,
    })

    expect(register).toHaveBeenCalledWith(analyticsFlushSyncTag)
  })

  it('reports unsupported when Background Sync is not available', async () => {
    await expect(
      registerBackgroundSync(offlineReviewSyncTag, {
        serviceWorker: {
          ready: Promise.resolve({}),
        },
      }),
    ).resolves.toEqual({
      status: 'unsupported',
      tag: offlineReviewSyncTag,
    })
  })

  it('recognizes Wordscodex service worker sync messages', () => {
    expect(
      isWordscodexBackgroundSyncMessage({
        type: backgroundSyncMessageType,
        tag: analyticsFlushSyncTag,
      }),
    ).toBe(true)
    expect(
      isWordscodexBackgroundSyncMessage({
        type: backgroundSyncMessageType,
        tag: 'unknown-tag',
      }),
    ).toBe(false)
  })
})
