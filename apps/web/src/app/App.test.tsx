import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('presents the stage zero product entry', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', {
        name: '把单词真正记住',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: '开始学习',
      }),
    ).toHaveAttribute('href', '/onboarding')
  })
})
