import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { User } from '@wordscodex/contracts'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../auth/auth-store'
import {
  AccountDeletionPage,
  type AccountDeletionClient,
} from './AccountDeletionPage'

const fixedIso = '2026-06-13T00:00:00.000Z'
const user: User = {
  id: 'user_123',
  email: 'learner@example.com',
  displayName: '学习者',
  role: 'learner',
  accountType: 'registered',
  timezone: 'Asia/Shanghai',
  createdAt: fixedIso,
  updatedAt: fixedIso,
}

function renderPage(client: AccountDeletionClient) {
  const router = createMemoryRouter(
    [
      {
        path: '/account/delete',
        element: <AccountDeletionPage authApi={client} />,
      },
      {
        path: '/login',
        element: <h1>开始你的词汇计划</h1>,
      },
    ],
    {
      initialEntries: ['/account/delete'],
    },
  )

  render(<RouterProvider router={router} />)
  return router
}

describe('AccountDeletionPage', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: 'access-token',
      user,
      initialized: true,
    })
  })

  it('requires an explicit confirmation before deleting the account', () => {
    const client = {
      deleteAccount: vi.fn(),
    } satisfies AccountDeletionClient
    renderPage(client)

    expect(
      screen.getByRole('heading', { name: '注销账号与删除数据' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/学习计划、学习记录、打卡记录/)).toBeInTheDocument()
    expect(screen.getByText(/分析事件会断开用户标识/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认注销账号' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('输入“注销账号”以确认'), {
      target: { value: '注销账号' },
    })

    expect(screen.getByRole('button', { name: '确认注销账号' })).toBeEnabled()
  })

  it('deletes the account, clears auth state, and redirects to login', async () => {
    const client = {
      deleteAccount: vi.fn().mockResolvedValue({
        deleted: true,
        anonymizedAnalytics: true,
      }),
    } satisfies AccountDeletionClient
    const router = renderPage(client)

    fireEvent.change(screen.getByLabelText('输入“注销账号”以确认'), {
      target: { value: '注销账号' },
    })
    fireEvent.click(screen.getByRole('button', { name: '确认注销账号' }))

    await waitFor(() =>
      expect(client.deleteAccount).toHaveBeenCalledWith('access-token'),
    )
    await screen.findByRole('heading', { name: '开始你的词汇计划' })
    expect(router.state.location.pathname).toBe('/login')
    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })
})
