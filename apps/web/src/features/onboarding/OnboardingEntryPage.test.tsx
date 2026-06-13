import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { OnboardingEntryPage } from './OnboardingEntryPage'

describe('OnboardingEntryPage', () => {
  it('points new learners to vocabulary selection', () => {
    render(
      <MemoryRouter>
        <OnboardingEntryPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole('link', { name: '选择词库' })).toHaveAttribute(
      'href',
      '/books',
    )
  })
})
