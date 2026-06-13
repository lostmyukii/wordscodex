import { useMutation, useQuery } from '@tanstack/react-query'
import type { MistakeListItem } from '@wordscodex/contracts'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../auth/auth-store'
import { mistakesApi, type MistakesClient } from './api'

type MistakesPageProps = {
  mistakesApi?: MistakesClient
}

const defaultDrillLimit = 20

export function MistakesPage({
  mistakesApi: client = mistakesApi,
}: MistakesPageProps) {
  const navigate = useNavigate()
  const accessToken = useAuthStore((state) => state.accessToken)
  const mistakesQuery = useQuery({
    queryKey: ['mistakes'],
    queryFn: () => client.listMistakes(requireAccessToken(accessToken)),
    enabled: Boolean(accessToken),
  })
  const createDrillMutation = useMutation({
    mutationFn: () =>
      client.createMistakeDrillSession(
        {
          limit: defaultDrillLimit,
        },
        requireAccessToken(accessToken),
      ),
    onSuccess(response) {
      void navigate(`/study/session/${response.session.id}`)
    },
  })

  if (mistakesQuery.isPending) {
    return <p className="route-status">正在加载错词本…</p>
  }

  if (mistakesQuery.isError) {
    return (
      <main className="app-shell">
        <section
          className="hero compact"
          aria-labelledby="mistakes-error-title"
        >
          <p className="eyebrow">错词本</p>
          <h1 id="mistakes-error-title">错词加载失败</h1>
          <p className="hero-copy">{getErrorMessage(mistakesQuery.error)}</p>
          <button
            className="primary-action"
            type="button"
            onClick={() => void mistakesQuery.refetch()}
          >
            重新加载错词
          </button>
        </section>
      </main>
    )
  }

  const mistakes = mistakesQuery.data
  const summaryText = `${mistakes.summary.total} 个待强化 · ${mistakes.summary.dueNow} 个已到期`

  if (!mistakes.plan) {
    return (
      <main className="app-shell">
        <section className="hero compact" aria-labelledby="mistakes-plan-title">
          <p className="eyebrow">错词本</p>
          <h1 id="mistakes-plan-title">还没有学习计划</h1>
          <p className="hero-copy">
            先选择一本词库并完成学习，系统才会生成错词强化任务。
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
      <section className="today-card" aria-labelledby="mistakes-title">
        <p className="eyebrow">错词强化</p>
        <h1 id="mistakes-title">错词本</h1>
        <p className="hero-copy">
          收集答错、模糊和遗忘的词，优先用主动回忆把它们拉回普通复习队列。
        </p>
        <p className="field-hint">{summaryText}</p>

        <div className="today-summary-grid" aria-label="错词概览">
          <div>
            <span>待强化</span>
            <strong>{mistakes.summary.total}</strong>
          </div>
          <div>
            <span>已到期</span>
            <strong>{mistakes.summary.dueNow}</strong>
          </div>
          <div>
            <span>复习上限</span>
            <strong>{mistakes.plan.dailyReviewLimit}</strong>
          </div>
        </div>

        {mistakes.items.length > 0 ? (
          <div className="mistake-list" aria-label="错词列表">
            {mistakes.items.map((item) => (
              <article className="mistake-card" key={item.word.id}>
                <div>
                  <div className="mistake-title-row">
                    <h2>{item.word.lemma}</h2>
                    <span className="state-badge">
                      {labelForMasteryState(item.masteryState)}
                    </span>
                  </div>
                  <p>{item.word.meanings[0]?.definitionZh}</p>
                  <p className="field-hint">
                    错 {item.incorrectCount} 次 · 正确 {item.correctCount} 次 ·
                    下次复习 {formatDateKey(item.nextReviewAt)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-note">暂无错词</p>
        )}

        {createDrillMutation.isError ? (
          <p className="form-alert" role="alert">
            {getErrorMessage(createDrillMutation.error)}
          </p>
        ) : null}

        <button
          className="primary-action"
          type="button"
          disabled={
            mistakes.items.length === 0 || createDrillMutation.isPending
          }
          onClick={() => createDrillMutation.mutate()}
        >
          开始错词强化
        </button>
      </section>
    </main>
  )
}

function labelForMasteryState(state: MistakeListItem['masteryState']) {
  switch (state) {
    case 'mistake':
      return '错词'
    case 'lapsed':
      return '遗忘'
    case 'fuzzy':
      return '模糊'
  }
}

function requireAccessToken(accessToken: string | null) {
  if (!accessToken) throw new Error('登录状态已失效，请重新登录。')
  return accessToken
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试。'
}

function formatDateKey(value: string | null) {
  return value ? value.slice(0, 10) : '待安排'
}
