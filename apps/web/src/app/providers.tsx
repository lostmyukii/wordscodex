import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { PropsWithChildren } from 'react'
import { AuthApiError, authApi } from '../features/auth/api'
import { useAuthStore } from '../features/auth/auth-store'
import { OfflineSyncCenter } from '../features/study/OfflineSyncCenter'
import { OfflineReviewSyncStatus } from '../features/study/OfflineReviewSyncStatus'
import { BackgroundSyncController } from './BackgroundSyncController'
import { PwaLifecycleStatusController } from './PwaLifecycleStatusController'

const queryClient = new QueryClient()

export function AppProviders({ children }: PropsWithChildren) {
  const setSession = useAuthStore((state) => state.setSession)
  const clearSession = useAuthStore((state) => state.clearSession)
  const finishInitialization = useAuthStore(
    (state) => state.finishInitialization,
  )

  useEffect(() => {
    let active = true
    const refreshStartedAccessToken = useAuthStore.getState().accessToken
    const hasNewerLocalSession = () =>
      useAuthStore.getState().accessToken !== refreshStartedAccessToken

    void authApi
      .refresh()
      .then((session) => {
        if (!active || hasNewerLocalSession()) return
        setSession(session)
      })
      .catch((error: unknown) => {
        if (!active) return
        if (hasNewerLocalSession()) {
          finishInitialization()
          return
        }
        if (error instanceof AuthApiError && error.code === 'UNAUTHORIZED') {
          clearSession()
          return
        }
        finishInitialization()
      })

    return () => {
      active = false
    }
  }, [clearSession, finishInitialization, setSession])

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <PwaLifecycleStatusController />
      <BackgroundSyncController />
      <OfflineSyncCenter />
      <OfflineReviewSyncStatus />
    </QueryClientProvider>
  )
}
