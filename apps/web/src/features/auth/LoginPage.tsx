import { useState, type FormEvent } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { authApi, type AuthClient } from './api'
import { useAuthStore } from './auth-store'

const timezone = 'Asia/Shanghai'
const emailSchema = z.string().trim().toLowerCase().email({
  message: '请输入有效的邮箱地址。',
})
const codeSchema = z.string().regex(/^\d{6}$/, {
  message: '请输入 6 位数字验证码。',
})

type EmailForm = {
  email: string
}

type CodeForm = {
  code: string
}

export type { AuthClient }

type LoginPageProps = {
  authApi?: AuthClient
}

export function LoginPage({ authApi: client = authApi }: LoginPageProps) {
  const navigate = useNavigate()
  const accessToken = useAuthStore((state) => state.accessToken)
  const setSession = useAuthStore((state) => state.setSession)
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [guestPending, setGuestPending] = useState(false)
  const emailForm = useForm<EmailForm>({
    defaultValues: {
      email: '',
    },
  })
  const codeForm = useForm<CodeForm>({
    defaultValues: {
      code: '',
    },
  })

  const submitEmail = emailForm.handleSubmit(
    async ({ email }) => {
      setApiError(null)
      const normalizedEmail = emailSchema.parse(email)
      await client.requestCode(normalizedEmail)
      setSubmittedEmail(normalizedEmail)
    },
    () => undefined,
  )

  const submitCode = codeForm.handleSubmit(
    async ({ code }) => {
      if (!submittedEmail) return
      setApiError(null)
      const session = await client.verifyCode({
        email: submittedEmail,
        code: codeSchema.parse(code),
        timezone,
        accessToken: accessToken ?? undefined,
      })
      setSession(session)
      void navigate('/onboarding')
    },
    () => undefined,
  )

  const continueAsGuest = async () => {
    setGuestPending(true)
    setApiError(null)
    try {
      const session = await client.guest(timezone)
      setSession(session)
      void navigate('/onboarding')
    } catch (error) {
      setApiError(getErrorMessage(error))
    } finally {
      setGuestPending(false)
    }
  }

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      await submitEmail(event)
    } catch (error) {
      setApiError(getErrorMessage(error))
    }
  }

  const handleCodeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      await submitCode(event)
    } catch (error) {
      setApiError(getErrorMessage(error))
    }
  }

  const emailError = emailForm.formState.errors.email?.message
  const codeError = codeForm.formState.errors.code?.message

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <p className="eyebrow">登录后继续学习</p>
        <h1 id="login-title">开始你的词汇计划</h1>
        <p className="auth-copy">
          用邮箱验证码登录，或先以访客身份体验完整的新手引导。
        </p>

        {apiError ? (
          <p className="form-alert" role="alert" aria-label={apiError}>
            {apiError}
          </p>
        ) : null}

        {!submittedEmail ? (
          <form
            className="auth-form"
            onSubmit={(event) => void handleEmailSubmit(event)}
            noValidate
          >
            <div className="form-field">
              <label htmlFor="email">邮箱</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                aria-describedby={emailError ? 'email-error' : 'email-hint'}
                aria-invalid={emailError ? 'true' : 'false'}
                {...emailForm.register('email', {
                  validate: (value) => {
                    const result = emailSchema.safeParse(value)
                    return (
                      result.success ||
                      result.error.issues[0]?.message ||
                      '请输入有效的邮箱地址。'
                    )
                  },
                })}
              />
              {emailError ? (
                <p className="field-error" id="email-error">
                  {emailError}
                </p>
              ) : (
                <p className="field-hint" id="email-hint">
                  我们会发送 6 位验证码，不会在响应中返回验证码。
                </p>
              )}
            </div>
            <button
              className="primary-action"
              type="submit"
              disabled={emailForm.formState.isSubmitting}
            >
              获取验证码
            </button>
          </form>
        ) : (
          <form
            className="auth-form"
            onSubmit={(event) => void handleCodeSubmit(event)}
            noValidate
          >
            <p className="success-note">验证码已发送，10 分钟内有效。</p>
            <div className="form-field">
              <label htmlFor="code">6 位验证码</label>
              <input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-describedby={codeError ? 'code-error' : 'code-hint'}
                aria-invalid={codeError ? 'true' : 'false'}
                {...codeForm.register('code', {
                  validate: (value) => {
                    const result = codeSchema.safeParse(value)
                    return (
                      result.success ||
                      result.error.issues[0]?.message ||
                      '请输入 6 位数字验证码。'
                    )
                  },
                })}
              />
              {codeError ? (
                <p className="field-error" id="code-error">
                  {codeError}
                </p>
              ) : (
                <p className="field-hint" id="code-hint">
                  已发送至 {submittedEmail}
                </p>
              )}
            </div>
            <button
              className="primary-action"
              type="submit"
              disabled={codeForm.formState.isSubmitting}
            >
              登录并继续
            </button>
          </form>
        )}

        <div className="guest-entry">
          <span>还不想绑定邮箱？</span>
          <button
            className="secondary-action"
            type="button"
            onClick={() => void continueAsGuest()}
            disabled={guestPending}
          >
            先体验一下
          </button>
        </div>
      </section>
    </main>
  )
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试。'
}
