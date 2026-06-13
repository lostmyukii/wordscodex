import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LegalPage } from './LegalPage'

describe('LegalPage', () => {
  it('renders the privacy policy with data and deletion commitments', () => {
    render(
      <MemoryRouter>
        <LegalPage kind="privacy" />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { name: '隐私政策' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/学习记录、打卡和同步状态/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '账号注销' })).toHaveAttribute(
      'href',
      '/account/delete',
    )
  })

  it('renders the user agreement with learner responsibilities', () => {
    render(
      <MemoryRouter>
        <LegalPage kind="terms" />
      </MemoryRouter>,
    )

    expect(
      screen.getByRole('heading', { name: '用户协议' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/主动回忆/)).toBeInTheDocument()
    expect(screen.getByText(/内容来源/)).toBeInTheDocument()
  })
})
