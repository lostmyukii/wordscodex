import { useRegisterSW } from 'virtual:pwa-register/react'
import { PwaLifecycleStatus } from './PwaLifecycleStatus'

export function PwaLifecycleStatusController() {
  const {
    needRefresh: [updateReady],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
  })

  return (
    <PwaLifecycleStatus
      serviceWorkerUpdate={{
        updateReady,
        applyUpdate: () => updateServiceWorker(true),
      }}
    />
  )
}
