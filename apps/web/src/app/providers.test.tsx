import { act, render, screen, waitFor } from '@testing-library/react'
import type { AuthSessionResponse } from '@wordscodex/contracts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppProviders } from './providers'
import { AuthApiError, authApi } from '../features/auth/api'
import { useAuthStore } from '../features/auth/auth-store'

vi.mock('../features/auth/api', () => {
  class AuthApiError extends Error {
    constructor(
      readonly code: string,
      message: string,
    ) {
      super(message)
      this.name = 'AuthApiError'
    }
  }

  return {
    AuthApiError,
    authApi: {
      refresh: vi.fn(),
    },
  }
})

vi.mock('../features/study/OfflineReviewSyncStatus', () => ({
  OfflineReviewSyncStatus: () => null,
}))

vi.mock('../features/study/OfflineSyncCenter', () => ({
  OfflineSyncCenter: () => null,
}))

vi.mock('./PwaLifecycleStatusController', () => ({
  PwaLifecycleStatusController: () => null,
}))

vi.mock('./BackgroundSyncController', () => ({
  BackgroundSyncController: () => null,
}))

const guestSession = {
  accessToken: 'guest-token',
  expiresInSeconds: 900,
  user: {
    id: 'guest_123',
    email: null,
    displayName: '游客',
    role: 'learner',
    accountType: 'guest',
    timezone: 'Asia/Shanghai',
    createdAt: '2026-06-13T00:00:00.000Z',
    updatedAt: '2026-06-13T00:00:00.000Z',
  },
} satisfies AuthSessionResponse

describe('AppProviders', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      user: null,
      initialized: false,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not clear a newer local session when startup refresh rejects later', async () => {
    let rejectRefresh: (error: unknown) => void = () => undefined
    vi.mocked(authApi).refresh.mockReturnValue(
      new Promise((_, reject) => {
        rejectRefresh = reject
      }),
    )

    render(
      <AppProviders>
        <AuthProbe />
      </AppProviders>,
    )

    act(() => {
      useAuthStore.getState().setSession(guestSession)
    })

    await act(async () => {
      rejectRefresh(new AuthApiError('UNAUTHORIZED', '登录状态已失效。'))
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(screen.getByTestId('access-token')).toHaveTextContent(
        'guest-token',
      )
      expect(screen.getByTestId('initialized')).toHaveTextContent('ready')
    })
  })
})

function AuthProbe() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const initialized = useAuthStore((state) => state.initialized)

  return (
    <div>
      <span data-testid="access-token">{accessToken ?? 'none'}</span>
      <span data-testid="initialized">{initialized ? 'ready' : 'pending'}</span>
    </div>
  )
}
