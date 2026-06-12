import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from './auth-store'

export function ProtectedRoute() {
  const initialized = useAuthStore((state) => state.initialized)
  const user = useAuthStore((state) => state.user)

  if (!initialized) {
    return <p className="route-status">正在恢复登录状态…</p>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
