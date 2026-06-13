import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { useAuthStore } from '../auth/auth-store'
import { studyApi, type StudyClient } from './api'

type StudyResultPageProps = {
  studyApi?: StudyClient
}

export function StudyResultPage({
  studyApi: client = studyApi,
}: StudyResultPageProps) {
  const { sessionId = '' } = useParams()
  const accessToken = useAuthStore((state) => state.accessToken)
  const resultQuery = useQuery({
    queryKey: ['study-session-result', sessionId],
    queryFn: () =>
      client.getSessionResult(sessionId, requireAccessToken(accessToken)),
    enabled: Boolean(accessToken) && sessionId.length > 0,
  })

  if (resultQuery.isPending) {
    return <p className="route-status">正在加载学习结果…</p>
  }

  if (resultQuery.isError) {
    return (
      <main className="app-shell">
        <section className="hero compact" aria-labelledby="result-error-title">
          <p className="eyebrow">学习结果</p>
          <h1 id="result-error-title">学习结果加载失败</h1>
          <p className="hero-copy">{getErrorMessage(resultQuery.error)}</p>
          <Link className="primary-action" to="/home">
            返回今日任务
          </Link>
        </section>
      </main>
    )
  }

  const result = resultQuery.data.result
  const accuracyPercent = Math.round(result.summary.accuracyRate * 100)

  return (
    <main className="study-shell">
      <section className="study-card" aria-labelledby="result-title">
        <p className="eyebrow">学习结果</p>
        <h1 id="result-title">学习结果</h1>
        <p className="hero-copy">
          <span>正确率 {accuracyPercent}%</span>
          <span aria-hidden="true"> · </span>
          <span>
            已完成 {result.summary.answeredItems} / {result.summary.totalItems}{' '}
            题
          </span>
        </p>

        <div className="result-summary-grid" aria-label="学习结果概览">
          <div>
            <span>正确</span>
            <strong>{result.summary.correctCount}</strong>
          </div>
          <div>
            <span>错词</span>
            <strong>{result.summary.incorrectCount}</strong>
          </div>
          <div>
            <span>用时</span>
            <strong>{formatSeconds(result.summary.totalResponseMs)}</strong>
          </div>
        </div>

        <div
          className={
            result.summary.canCheckIn ? 'checkin-card ready' : 'checkin-card'
          }
          aria-label="打卡状态"
        >
          <strong>
            {result.summary.canCheckIn ? '今日已满足打卡条件' : '还不能打卡'}
          </strong>
          <span>
            {result.summary.canCheckIn
              ? '完成至少 1 个学习会话后，今日首页会开放打卡入口。'
              : '需要完成并同步学习会话后才能打卡。'}
          </span>
        </div>

        <div className="result-item-list" aria-label="本次作答明细">
          {result.items.map((item) => (
            <article className="result-item-card" key={item.word.id}>
              <div>
                <h2>{item.word.lemma}</h2>
                <p>{item.word.meanings[0]?.definitionZh ?? '暂无释义'}</p>
              </div>
              <div>
                <strong>{item.isCorrect ? '答对' : '待强化'}</strong>
                <span>下次复习：{formatDateKey(item.nextReviewAt)}</span>
              </div>
            </article>
          ))}
        </div>

        <Link className="primary-action" to="/home">
          返回今日任务
        </Link>
      </section>
    </main>
  )
}

function requireAccessToken(accessToken: string | null) {
  if (!accessToken) throw new Error('登录状态已失效，请重新登录。')
  return accessToken
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试。'
}

function formatDateKey(value: string | null) {
  return value ? value.slice(0, 10) : '待计算'
}

function formatSeconds(totalResponseMs: number) {
  return `${Math.ceil(totalResponseMs / 1000)} 秒`
}
