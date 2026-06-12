import { expect, test } from '@playwright/test'

test('shows a usable mobile product entry', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', {
      name: '把单词真正记住',
    }),
  ).toBeVisible()

  const action = page.getByRole('link', {
    name: '开始学习',
  })

  await expect(action).toBeVisible()
  await expect(action).toHaveAttribute('href', '/onboarding')
})
