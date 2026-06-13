import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../auth/auth-store'
import { studyApi, type StudyClient } from '../study/api'

type HomePageProps = {
  studyApi?: StudyClient
}

export function HomePage({ studyApi: client = studyApi }: HomePageProps) {
  const navigate = useNavigate()
  const accessToken = useAuthStore((state) => state.accessToken)
  const todayQuery = useQuery({
    queryKey: ['today'],
    queryFn: () => client.getToday(requireAccessToken(accessToken)),
    enabled: Boolean(accessToken),
  })
  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const recommendation = todayQuery.data?.nextSessionRecommendation
      if (!recommendation) {
        throw new Error('今日暂无可开始的学习任务。')
      }

      return client.createSession(
        {
          mode: recommendation.mode,
          newWordLimit: recommendation.newWordLimit,
          reviewLimit: recommendation.reviewLimit,
        },
        requireAccessToken(accessToken),
      )
    },
    onSuccess: (response) => {
      void navigate(`/study/session/${response.session.id}`)
    },
  })

  if (todayQuery.isPending) {
    return <p className="route-status">正在加载今日任务…</p>
  }

  if (todayQuery.isError) {
    return (
      <main className="app-shell">
        <section className="hero compact" aria-labelledby="today-error-title">
          <p className="eyebrow">今日任务</p>
          <h1 id="today-error-title">今日任务加载失败</h1>
          <p className="hero-copy">{getErrorMessage(todayQuery.error)}</p>
          <button
            className="primary-action"
            type="button"
            onClick={() => void todayQuery.refetch()}
          >
            重新加载今日任务
          </button>
        </section>
      </main>
    )
  }

  const today = todayQuery.data

  if (!today.plan) {
    return (
      <main className="app-shell">
        <section className="hero compact" aria-labelledby="empty-plan-title">
          <p className="eyebrow">今日任务</p>
          <h1 id="empty-plan-title">还没有学习计划</h1>
          <p className="hero-copy">
            先选择一本词库并生成计划，系统才会安排今日新词和复习。
          </p>
          <Link className="primary-action" to="/books">
            选择词库
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="home-shell">
      <section className="today-card" aria-labelledby="home-title">
        <p className="eyebrow">今日任务</p>
        <h1 id="home-title">今日任务</h1>
        <p className="hero-copy">
          {today.summary.date} · 每日新词 {today.plan.dailyNewWordTarget} 个 ·
          复习上限 {today.plan.dailyReviewLimit} 个
        </p>

        <div className="today-summary-grid" aria-label="今日学习概览">
          <div>
            <span>新词</span>
            <strong>{today.summary.newWordsDue}</strong>
          </div>
          <div>
            <span>到期复习</span>
            <strong>{today.summary.reviewsDue}</strong>
          </div>
          <div>
            <span>已完成会话</span>
            <strong>{today.summary.completedSessions}</strong>
          </div>
        </div>

        <div
          className={
            today.summary.canCheckIn ? 'checkin-card ready' : 'checkin-card'
          }
          aria-label="打卡状态"
        >
          <strong>{today.summary.canCheckIn ? '可打卡' : '待完成'}</strong>
          <span>
            {today.summary.canCheckIn
              ? `今天已完成 ${today.summary.completedSessions} 个学习会话`
              : '完成至少 1 个学习会话后开放打卡'}
          </span>
        </div>

        {today.tasks.length > 0 ? (
          <div className="task-list" aria-label="今日任务列表">
            {today.tasks.map((task) => (
              <article className="task-card" key={task.type}>
                <div>
                  <h2>{task.title}</h2>
                  <p>{task.description}</p>
                </div>
                <strong>{task.count} 个</strong>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-note">今日任务已经清空，可以休息一下。</p>
        )}

        {createSessionMutation.isError ? (
          <p className="form-alert" role="alert">
            {getErrorMessage(createSessionMutation.error)}
          </p>
        ) : null}

        <button
          className="primary-action"
          type="button"
          disabled={
            !today.nextSessionRecommendation || createSessionMutation.isPending
          }
          onClick={() => createSessionMutation.mutate()}
        >
          开始今日学习
        </button>
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
