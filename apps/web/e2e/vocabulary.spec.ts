import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.clearCookies()
})

test('selects a vocabulary book on mobile', async ({ page }) => {
  await page.goto('/login')

  await page.getByRole('button', { name: '先体验一下' }).click()
  await expect(page).toHaveURL('/onboarding')

  await page.getByRole('link', { name: '选择词库' }).click()
  await expect(page).toHaveURL('/books')

  await page.getByLabel('搜索词库').fill('四级')
  await expect(page.getByText('大学英语四级核心词汇')).toBeVisible()
  await expect(page.getByText('2600 词')).toBeVisible()

  await page.getByRole('link', { name: '查看 大学英语四级核心词汇' }).click()

  await expect(page).toHaveURL('/books/cet4-core')
  await expect(
    page.getByRole('heading', { name: '大学英语四级核心词汇' }),
  ).toBeVisible()
  await expect(page.getByText('2600 个核心词')).toBeVisible()
  await expect(
    page.getByRole('link', { name: '选择这个词库' }),
  ).toHaveAttribute('href', '/onboarding?book=cet4-core')
})
