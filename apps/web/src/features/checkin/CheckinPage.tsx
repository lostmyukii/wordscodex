import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CheckinListResponse } from '@wordscodex/contracts'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../auth/auth-store'
import { checkinApi, type CheckinClient } from './api'

type CheckinPageProps = {
  checkinApi?: CheckinClient
}

export function CheckinPage({
  checkinApi: client = checkinApi,
}: CheckinPageProps) {
  const queryClient = useQueryClient()
  const accessToken = useAuthStore((state) => state.accessToken)
  const checkinsQuery = useQuery({
    queryKey: ['checkins'],
    queryFn: () => client.listCheckins(requireAccessToken(accessToken)),
    enabled: Boolean(accessToken),
  })
  const createCheckinMutation = useMutation({
    mutationFn: () => client.createCheckin(requireAccessToken(accessToken)),
    onSuccess(response) {
      queryClient.setQueryData<CheckinListResponse>(
        ['checkins'],
        (current) => ({
          summary: response.summary,
          items: mergeCheckin(current?.items ?? [], response.checkin),
        }),
      )
    },
  })

  if (checkinsQuery.isPending) {
    return <p className="route-status">正在加载打卡记录…</p>
  }

  if (checkinsQuery.isError) {
    return (
      <main className="app-shell">
        <section className="hero compact" aria-labelledby="checkin-error-title">
          <p className="eyebrow">今日打卡</p>
          <h1 id="checkin-error-title">打卡记录加载失败</h1>
          <p className="hero-copy">{getErrorMessage(checkinsQuery.error)}</p>
          <button
            className="primary-action"
            type="button"
            onClick={() => void checkinsQuery.refetch()}
          >
            重新加载打卡记录
          </button>
        </section>
      </main>
    )
  }

  const summary =
    createCheckinMutation.data?.summary ?? checkinsQuery.data.summary
  const items =
    queryClient.getQueryData<CheckinListResponse>(['checkins'])?.items ??
    checkinsQuery.data.items

  return (
    <main className="home-shell">
      <section className="today-card" aria-labelledby="checkin-title">
        <p className="eyebrow">学习闭环</p>
        <h1 id="checkin-title">今日打卡</h1>
        <p className="hero-copy">
          {summary.todayKey} ·{' '}
          <span>已连续打卡 {summary.currentStreak} 天</span>
        </p>

        <div
          className={
            summary.checkedInToday ? 'checkin-card ready' : 'checkin-card'
          }
          aria-label="今日打卡状态"
        >
          <strong>
            {summary.checkedInToday ? '今日已打卡' : '今天还没有打卡'}
          </strong>
          <span>
            {summary.checkedInToday
              ? '今天的学习已记录进连续打卡。'
              : '完成至少 1 个学习会话后，就可以记录今天的学习闭环。'}
          </span>
        </div>

        <div className="checkin-day-list" aria-label="近 7 天打卡">
          {summary.recentDays.map((day) => (
            <span
              className={day.checkedIn ? 'checkin-day checked' : 'checkin-day'}
              key={day.dateKey}
              aria-label={`${day.dateKey} ${day.checkedIn ? '已打卡' : '未打卡'}`}
            >
              {day.dateKey.slice(5)}
            </span>
          ))}
        </div>

        {items.length > 0 ? (
          <div className="task-list" aria-label="打卡记录列表">
            {items.slice(0, 5).map((item) => (
              <article className="task-card" key={item.id}>
                <div>
                  <h2>{item.dateKey}</h2>
                  <p>完成 {item.completedSessions} 个学习会话</p>
                </div>
                <strong>已打卡</strong>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-note">暂无打卡记录</p>
        )}

        {createCheckinMutation.isError ? (
          <p className="form-alert" role="alert">
            {getErrorMessage(createCheckinMutation.error)}
          </p>
        ) : null}

        <div className="action-row">
          <button
            className="primary-action"
            type="button"
            disabled={summary.checkedInToday || createCheckinMutation.isPending}
            onClick={() => createCheckinMutation.mutate()}
          >
            今日打卡
          </button>
          <Link className="secondary-action" to="/dashboard">
            查看学习看板
          </Link>
          <Link className="text-link" to="/home">
            返回今日任务
          </Link>
        </div>
      </section>
    </main>
  )
}

function mergeCheckin(
  items: CheckinListResponse['items'],
  checkin: CheckinListResponse['items'][number],
) {
  return [checkin, ...items.filter((item) => item.id !== checkin.id)].sort(
    (a, b) => b.dateKey.localeCompare(a.dateKey),
  )
}

function requireAccessToken(accessToken: string | null) {
  if (!accessToken) throw new Error('登录状态已失效，请重新登录。')
  return accessToken
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试。'
}
