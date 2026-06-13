import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.clearCookies()
})

test('adds a wrong answer to mistakes and starts drill on mobile', async ({
  page,
}) => {
  await page.goto('/login')

  await page.getByRole('button', { name: '先体验一下' }).click()
  await expect(page).toHaveURL('/onboarding')

  await page.getByRole('link', { name: '选择词库' }).click()
  await page.getByRole('link', { name: '查看 大学英语四级核心词汇' }).click()
  await page.getByRole('link', { name: '选择这个词库' }).click()
  await page.getByRole('button', { name: '生成学习计划' }).click()

  await expect(page).toHaveURL('/home')
  await page.getByRole('button', { name: '开始今日学习' }).click()

  await expect(page).toHaveURL(/\/study\/session\/.+/)
  await expect(
    page.getByRole('heading', { name: 'ability 的中文意思是？' }),
  ).toBeVisible()

  await page.getByRole('button', { name: '不认识' }).click()
  await expect(page.getByText('作答已记录')).toBeVisible()

  for (let answerIndex = 0; answerIndex < 10; answerIndex += 1) {
    if (await page.getByRole('button', { name: '完成会话' }).isVisible()) {
      break
    }

    await page.getByRole('button', { name: '下一题' }).click()
    await page.getByRole('button', { name: '认识', exact: true }).click()
    await expect(page.getByText('作答已记录')).toBeVisible()
  }

  await page.getByRole('button', { name: '完成会话' }).click()
  await expect(page).toHaveURL(/\/study\/result\/.+/)

  await page.goto('/mistakes')
  await expect(page.getByRole('heading', { name: '错词本' })).toBeVisible()
  await expect(page.getByText('ability')).toBeVisible()
  await expect(page.getByText('错词', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: '开始错词强化' }).click()

  await expect(page).toHaveURL(/\/study\/session\/.+/)
  await expect(page.getByText(/错词强化 · 共 1 题/)).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'ability 的中文意思是？' }),
  ).toBeVisible()
})
