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

  await page.getByRole('link', { name: '选择这个词库' }).click()

  await expect(page).toHaveURL('/onboarding?book=cet4-core')
  await expect(
    page.getByRole('heading', { name: '生成你的学习计划' }),
  ).toBeVisible()
  await expect(page.getByText('大学英语四级核心词汇')).toBeVisible()

  await page.getByLabel('每日新词量').fill('50')
  await page.getByLabel('开启学习提醒').check()
  await page.getByRole('button', { name: '生成学习计划' }).click()

  await expect(page).toHaveURL('/home')
  await expect(page.getByRole('heading', { name: '今日任务' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '今日新词' })).toBeVisible()

  await page.getByRole('button', { name: '开始今日学习' }).click()

  await expect(page).toHaveURL(/\/study\/session\/.+/)
  await expect(page.getByRole('heading', { name: '学习会话' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'ability 的中文意思是？' }),
  ).toBeVisible()

  await page.getByRole('button', { name: '认识', exact: true }).click()

  await expect(page.getByText('作答已记录')).toBeVisible()
  await expect(page.getByText('下次复习：2026-06-15')).toBeVisible()
})
