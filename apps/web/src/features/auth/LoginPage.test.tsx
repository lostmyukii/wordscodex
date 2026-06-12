import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AuthSessionResponse } from '@wordscodex/contracts'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage, type AuthClient } from './LoginPage'
import { useAuthStore } from './auth-store'

const session: AuthSessionResponse = {
  accessToken: 'access-token',
  expiresInSeconds: 900,
  user: {
    id: 'user_123',
    email: 'learner@example.com',
    displayName: '学习者',
    role: 'learner',
    accountType: 'registered',
    timezone: 'Asia/Shanghai',
    createdAt: '2026-06-12T00:00:00.000Z',
    updatedAt: '2026-06-12T00:00:00.000Z',
  },
}

function createAuthClient(overrides: Partial<AuthClient> = {}) {
  const mocks = {
    requestCode: vi.fn().mockResolvedValue({
      accepted: true,
      expiresInSeconds: 600,
    }),
    verifyCode: vi.fn().mockResolvedValue(session),
    guest: vi.fn().mockResolvedValue({
      ...session,
      user: {
        ...session.user,
        email: null,
        accountType: 'guest',
      },
    }),
    refresh: vi.fn().mockRejectedValue(new Error('未登录')),
  }

  return {
    authApi: {
      ...mocks,
      ...overrides,
    } satisfies AuthClient,
    mocks,
  }
}

function renderLogin(setup = createAuthClient()) {
  const { authApi } = setup
  const router = createMemoryRouter(
    [
      {
        path: '/login',
        element: <LoginPage authApi={authApi} />,
      },
      {
        path: '/onboarding',
        element: <h1>开始制定学习计划</h1>,
      },
    ],
    {
      initialEntries: ['/login'],
    },
  )

  render(<RouterProvider router={router} />)
  return { ...setup, router }
}

describe('LoginPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      user: null,
      initialized: true,
    })
  })

  it('submits a valid email and displays the verification step', async () => {
    const { mocks } = renderLogin()

    fireEvent.change(screen.getByLabelText('邮箱'), {
      target: { value: 'learner@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: '获取验证码' }))

    await waitFor(() =>
      expect(mocks.requestCode).toHaveBeenCalledWith('learner@example.com'),
    )
    expect(screen.getByLabelText('6 位验证码')).toBeInTheDocument()
    expect(
      screen.getByText('验证码已发送，10 分钟内有效。'),
    ).toBeInTheDocument()
  })

  it('associates an invalid email message with the email input', async () => {
    renderLogin()
    const email = screen.getByLabelText('邮箱')

    fireEvent.change(email, {
      target: { value: 'not-an-email' },
    })
    fireEvent.click(screen.getByRole('button', { name: '获取验证码' }))

    const error = await screen.findByText('请输入有效的邮箱地址。')
    expect(email).toHaveAccessibleDescription('请输入有效的邮箱地址。')
    expect(error).toHaveAttribute('id')
  })

  it('verifies a six digit code and navigates to onboarding', async () => {
    const { mocks, router } = renderLogin()

    fireEvent.change(screen.getByLabelText('邮箱'), {
      target: { value: 'learner@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: '获取验证码' }))
    await screen.findByLabelText('6 位验证码')

    fireEvent.change(screen.getByLabelText('6 位验证码'), {
      target: { value: '123456' },
    })
    fireEvent.click(screen.getByRole('button', { name: '登录并继续' }))

    await screen.findByRole('heading', { name: '开始制定学习计划' })
    expect(mocks.verifyCode).toHaveBeenCalledWith({
      email: 'learner@example.com',
      code: '123456',
      timezone: 'Asia/Shanghai',
      accessToken: undefined,
    })
    expect(router.state.location.pathname).toBe('/onboarding')
  })

  it('creates a guest and navigates to onboarding', async () => {
    const { mocks, router } = renderLogin()

    fireEvent.click(screen.getByRole('button', { name: '先体验一下' }))

    await screen.findByRole('heading', { name: '开始制定学习计划' })
    expect(mocks.guest).toHaveBeenCalledWith('Asia/Shanghai')
    expect(router.state.location.pathname).toBe('/onboarding')
  })

  it('shows a Chinese API error and enables retry', async () => {
    const setup = createAuthClient({
      requestCode: vi
        .fn()
        .mockRejectedValueOnce(new Error('请求过于频繁，请稍后再试。')),
    })
    renderLogin(setup)

    fireEvent.change(screen.getByLabelText('邮箱'), {
      target: { value: 'learner@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: '获取验证码' }))

    expect(
      await screen.findByRole('alert', {
        name: '请求过于频繁，请稍后再试。',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '获取验证码' })).toBeEnabled()
  })
})
