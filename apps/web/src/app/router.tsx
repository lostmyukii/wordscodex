import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { App } from './App'
import { LoginPage } from '../features/auth/LoginPage'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
import { HomePage } from '../features/home/HomePage'
import { OnboardingEntryPage } from '../features/onboarding/OnboardingEntryPage'
import { StudySessionPage } from '../features/study/StudySessionPage'
import { VocabularyBookDetailPage } from '../features/vocabulary/VocabularyBookDetailPage'
import { VocabularyBooksPage } from '../features/vocabulary/VocabularyBooksPage'

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
        {
          path: '/home',
          element: <HomePage />,
        },
        {
          path: '/study/session/:sessionId',
          element: <StudySessionPage />,
        },
        {
          path: '/books',
          element: <VocabularyBooksPage />,
        },
        {
          path: '/books/:bookId',
          element: <VocabularyBookDetailPage />,
        },
      ],
    },
  ])
}

export function AppRouter() {
  return <RouterProvider router={createAppRouter()} />
}
