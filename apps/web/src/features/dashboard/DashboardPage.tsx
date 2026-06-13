import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../auth/auth-store'
import { dashboardApi, type DashboardClient } from './api'

type DashboardPageProps = {
  dashboardApi?: DashboardClient
}

export function DashboardPage({
  dashboardApi: client = dashboardApi,
}: DashboardPageProps) {
  const accessToken = useAuthStore((state) => state.accessToken)
  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => client.getSummary(requireAccessToken(accessToken)),
    enabled: Boolean(accessToken),
  })

  if (summaryQuery.isPending) {
    return <p className="route-status">正在加载学习看板…</p>
  }

  if (summaryQuery.isError) {
    return (
      <main className="app-shell">
        <section
          className="hero compact"
          aria-labelledby="dashboard-error-title"
        >
          <p className="eyebrow">学习看板</p>
          <h1 id="dashboard-error-title">看板加载失败</h1>
          <p className="hero-copy">{getErrorMessage(summaryQuery.error)}</p>
          <button
            className="primary-action"
            type="button"
            onClick={() => void summaryQuery.refetch()}
          >
            重新加载看板
          </button>
        </section>
      </main>
    )
  }

  const summary = summaryQuery.data

  return (
    <main className="home-shell">
      <section className="today-card" aria-labelledby="dashboard-title">
        <p className="eyebrow">学习反馈</p>
        <h1 id="dashboard-title">学习看板</h1>
        <p className="hero-copy">
          {summary.progress.activeBookName ?? '还没有活动词库'} ·{' '}
          {summary.today.dateKey} ·{' '}
          <span>连续打卡 {summary.streak.current} 天</span>
        </p>

        <div className="today-summary-grid" aria-label="学习看板概览">
          <div>
            <span>今日会话</span>
            <strong>{summary.today.completedSessions}</strong>
          </div>
          <div>
            <span>已学习</span>
            <strong>{summary.progress.learnedWords}</strong>
          </div>
          <div>
            <span>已掌握</span>
            <strong>{summary.progress.masteredWords}</strong>
          </div>
        </div>

        <div className="dashboard-progress-card">
          <div>
            <strong>{summary.progress.activeBookName ?? '暂无活动计划'}</strong>
            <span>
              总词量 {summary.progress.totalWords} · 到期复习{' '}
              {summary.progress.dueReviews}
            </span>
          </div>
          <p>
            累计作答 {summary.totals.reviewLogs} 次 · 打卡{' '}
            {summary.totals.checkins} 天 · 当前连续 {summary.streak.current} 天
          </p>
        </div>

        <div className="checkin-day-list" aria-label="近 7 天打卡">
          {summary.streak.recentDays.map((day) => (
            <span
              className={day.checkedIn ? 'checkin-day checked' : 'checkin-day'}
              key={day.dateKey}
              aria-label={`${day.dateKey} ${day.checkedIn ? '已打卡' : '未打卡'}`}
            >
              {day.dateKey.slice(5)}
            </span>
          ))}
        </div>

        <div
          className={
            summary.today.checkedInToday ? 'checkin-card ready' : 'checkin-card'
          }
          aria-label="今日打卡状态"
        >
          <strong>
            {summary.today.checkedInToday
              ? '今日已打卡'
              : summary.today.canCheckIn
                ? '今日可打卡'
                : '今日待学习'}
          </strong>
          <span>
            {summary.today.canCheckIn
              ? `今天已完成 ${summary.today.completedSessions} 个学习会话`
              : '完成学习会话后，打卡入口会开放。'}
          </span>
        </div>

        <div className="action-row">
          <Link className="primary-action" to="/checkin">
            去打卡
          </Link>
          <Link className="secondary-action" to="/home">
            返回今日任务
          </Link>
        </div>
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
