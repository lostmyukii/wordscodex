import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { App } from './App'
import { LoginPage } from '../features/auth/LoginPage'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
import { HomePage } from '../features/home/HomePage'
import { MistakesPage } from '../features/mistakes/MistakesPage'
import { OnboardingEntryPage } from '../features/onboarding/OnboardingEntryPage'
import { StudyResultPage } from '../features/study/StudyResultPage'
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
          path: '/mistakes',
          element: <MistakesPage />,
        },
        {
          path: '/study/session/:sessionId',
          element: <StudySessionPage />,
        },
        {
          path: '/study/result/:sessionId',
          element: <StudyResultPage />,
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
