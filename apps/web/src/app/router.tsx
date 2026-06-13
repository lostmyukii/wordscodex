import {
  createBrowserRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router-dom'
import { App } from './App'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'

export function createAppRoutes(): RouteObject[] {
  return [
    {
      path: '/',
      Component: App,
    },
    {
      path: '/login',
      lazy: async () => {
        const { LoginPage } = await import('../features/auth/LoginPage')
        return { Component: LoginPage }
      },
    },
    {
      path: '/privacy',
      lazy: async () => {
        const { LegalPage } = await import('../features/legal/LegalPage')
        return { Component: () => <LegalPage kind="privacy" /> }
      },
    },
    {
      path: '/terms',
      lazy: async () => {
        const { LegalPage } = await import('../features/legal/LegalPage')
        return { Component: () => <LegalPage kind="terms" /> }
      },
    },
    {
      Component: ProtectedRoute,
      children: [
        {
          path: '/account/delete',
          lazy: async () => {
            const { AccountDeletionPage } =
              await import('../features/account/AccountDeletionPage')
            return { Component: AccountDeletionPage }
          },
        },
        {
          path: '/onboarding',
          lazy: async () => {
            const { OnboardingEntryPage } =
              await import('../features/onboarding/OnboardingEntryPage')
            return { Component: OnboardingEntryPage }
          },
        },
        {
          path: '/home',
          lazy: async () => {
            const { HomePage } = await import('../features/home/HomePage')
            return { Component: HomePage }
          },
        },
        {
          path: '/mistakes',
          lazy: async () => {
            const { MistakesPage } =
              await import('../features/mistakes/MistakesPage')
            return { Component: MistakesPage }
          },
        },
        {
          path: '/checkin',
          lazy: async () => {
            const { CheckinPage } =
              await import('../features/checkin/CheckinPage')
            return { Component: CheckinPage }
          },
        },
        {
          path: '/dashboard',
          lazy: async () => {
            const { DashboardPage } =
              await import('../features/dashboard/DashboardPage')
            return { Component: DashboardPage }
          },
        },
        {
          path: '/study/session/:sessionId',
          lazy: async () => {
            const { StudySessionPage } =
              await import('../features/study/StudySessionPage')
            return { Component: StudySessionPage }
          },
        },
        {
          path: '/study/result/:sessionId',
          lazy: async () => {
            const { StudyResultPage } =
              await import('../features/study/StudyResultPage')
            return { Component: StudyResultPage }
          },
        },
        {
          path: '/books',
          lazy: async () => {
            const { VocabularyBooksPage } =
              await import('../features/vocabulary/VocabularyBooksPage')
            return { Component: VocabularyBooksPage }
          },
        },
        {
          path: '/books/:bookId',
          lazy: async () => {
            const { VocabularyBookDetailPage } =
              await import('../features/vocabulary/VocabularyBookDetailPage')
            return { Component: VocabularyBookDetailPage }
          },
        },
      ],
    },
  ]
}

export function createAppRouter() {
  return createBrowserRouter(createAppRoutes())
}

export function AppRouter() {
  return <RouterProvider router={createAppRouter()} />
}
