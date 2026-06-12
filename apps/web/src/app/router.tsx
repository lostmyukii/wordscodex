import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { App } from './App'
import { LoginPage } from '../features/auth/LoginPage'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
import { OnboardingEntryPage } from '../features/onboarding/OnboardingEntryPage'

export function createAppRouter() {
  return createBrowserRouter([
    {
      path: '/',
      element: <App />,
    },
    {
      path: '/login',
      element: <LoginPage />,
    },
    {
      element: <ProtectedRoute />,
      children: [
        {
          path: '/onboarding',
          element: <OnboardingEntryPage />,
        },
      ],
    },
  ])
}

export function AppRouter() {
  return <RouterProvider router={createAppRouter()} />
}
