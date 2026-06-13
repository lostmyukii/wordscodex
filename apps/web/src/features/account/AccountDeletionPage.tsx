import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { DeleteAccountResponse } from '@wordscodex/contracts'
import { authApi } from '../auth/api'
import { useAuthStore } from '../auth/auth-store'

export type AccountDeletionClient = {
  deleteAccount(accessToken: string): Promise<DeleteAccountResponse>
}

type AccountDeletionPageProps = {
  authApi?: AccountDeletionClient
}

const confirmationText = '注销账号'

export function AccountDeletionPage({
  authApi: client = authApi,
}: AccountDeletionPageProps) {
  const navigate = useNavigate()
  const accessToken = useAuthStore((state) => state.accessToken)
  const user = useAuthStore((state) => state.user)
  const clearSession = useAuthStore((state) => state.clearSession)
  const [confirmation, setConfirmation] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const canSubmit = confirmation === confirmationText && !isSubmitting

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return

    if (!accessToken) {
      setErrorMessage('登录状态已失效，请重新登录。')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await client.deleteAccount(accessToken)
      clearSession()
      void navigate('/login', { replace: true })
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '账号注销失败，请稍后重试。',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="legal-shell">
      <section
        className="legal-card danger-card"
        aria-labelledby="delete-title"
      >
        <p className="eyebrow">账号安全 · 数据删除</p>
        <h1 id="delete-title">注销账号与删除数据</h1>
        <p className="hero-copy">
          当前账号：{user?.email ?? '游客账号'}。提交后，账号将无法恢复。
        </p>

        <div className="legal-section-list">
          <section>
            <h2>删除范围</h2>
            <p>
              学习计划、学习记录、打卡记录、离线会话和登录会话会从服务端删除。
            </p>
          </section>
          <section>
            <h2>统计处理</h2>
            <p>
              分析事件会断开用户标识，仅保留不可反查的聚合指标用于 MVP
              质量观察。
            </p>
          </section>
          <section>
            <h2>操作确认</h2>
            <p>
              为避免误操作，请在下方输入“注销账号”后再提交。提交成功后会回到登录页。
            </p>
          </section>
        </div>

        {errorMessage ? (
          <p className="form-alert" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <form
          className="auth-form"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div className="form-field">
            <label htmlFor="delete-confirmation">输入“注销账号”以确认</label>
            <input
              id="delete-confirmation"
              name="delete-confirmation"
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </div>

          <button className="danger-action" type="submit" disabled={!canSubmit}>
            {isSubmitting ? '正在注销…' : '确认注销账号'}
          </button>
        </form>

        <Link className="secondary-action" to="/home">
          暂不注销，返回今日任务
        </Link>
      </section>
    </main>
  )
}
