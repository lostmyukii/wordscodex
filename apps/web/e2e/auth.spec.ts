import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.clearCookies()
})

test('logs in with an email verification code on mobile', async ({
  page,
}, testInfo) => {
  const email = `learner-${testInfo.workerIndex}-${Date.now()}@example.com`

  await page.goto('/login')

  await page.getByLabel('邮箱').fill(email)
  await page.getByRole('button', { name: '获取验证码' }).click()

  await expect(page.getByText('验证码已发送，10 分钟内有效。')).toBeVisible()
  await page.getByLabel('6 位验证码').fill('123456')
  await page.getByRole('button', { name: '登录并继续' }).click()

  await expect(page).toHaveURL('/onboarding')
  await expect(
    page.getByRole('heading', {
      name: '开始制定学习计划',
    }),
  ).toBeVisible()
})

test('starts as a guest on mobile', async ({ page }) => {
  await page.goto('/login')

  await page.getByRole('button', { name: '先体验一下' }).click()

  await expect(page).toHaveURL('/onboarding')
  await expect(
    page.getByRole('heading', {
      name: '开始制定学习计划',
    }),
  ).toBeVisible()
})
