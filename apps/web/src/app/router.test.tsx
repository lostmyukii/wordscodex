import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createAppRoutes } from './router'

describe('app router', () => {
  it('keeps page routes lazy so the initial PWA shell stays small', () => {
    const routes = createAppRoutes()
    const loginRoute = routes.find((route) => route.path === '/login')
    const privacyRoute = routes.find((route) => route.path === '/privacy')
    const termsRoute = routes.find((route) => route.path === '/terms')
    const protectedRoutes = routes.flatMap((route) => route.children ?? [])
    const accountDeletionRoute = protectedRoutes.find(
      (route) => route.path === '/account/delete',
    )

    expect(loginRoute?.lazy).toEqual(expect.any(Function))
    expect(privacyRoute?.lazy).toEqual(expect.any(Function))
    expect(termsRoute?.lazy).toEqual(expect.any(Function))
    expect(accountDeletionRoute?.lazy).toEqual(expect.any(Function))
    expect(
      protectedRoutes.every((route) => typeof route.lazy === 'function'),
    ).toBe(true)
  })

  it('renders a lazy login route', async () => {
    const router = createMemoryRouter(createAppRoutes(), {
      initialEntries: ['/login'],
    })

    render(<RouterProvider router={router} />)

    expect(
      await screen.findByRole('heading', { name: '开始你的词汇计划' }),
    ).toBeInTheDocument()
  })
})
