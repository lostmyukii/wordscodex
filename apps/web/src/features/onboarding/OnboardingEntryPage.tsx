import { useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  createStudyPlanRequestSchema,
  type LearningGoal,
} from '@wordscodex/contracts'
import { useAuthStore } from '../auth/auth-store'
import { vocabularyApi, type VocabularyClient } from '../vocabulary/api'
import { studyPlanApi, type StudyPlanClient } from './api'

type OnboardingEntryPageProps = {
  studyPlanApi?: StudyPlanClient
  vocabularyApi?: VocabularyClient
}

type PlanForm = {
  learningGoal: LearningGoal
  dailyNewWordTarget: number
  targetDate: string
  reminderEnabled: boolean
}

export function OnboardingEntryPage({
  studyPlanApi: planClient = studyPlanApi,
  vocabularyApi: bookClient = vocabularyApi,
}: OnboardingEntryPageProps) {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const selectedBookId = searchParams.get('book')?.trim() ?? ''
  const accessToken = useAuthStore((state) => state.accessToken)
  const [apiError, setApiError] = useState<string | null>(null)
  const form = useForm<PlanForm>({
    defaultValues: {
      learningGoal: 'college',
      dailyNewWordTarget: 50,
      targetDate: '',
      reminderEnabled: false,
    },
  })
  const activePlanQuery = useQuery({
    queryKey: ['active-study-plan'],
    queryFn: () => planClient.getActivePlan(requireAccessToken(accessToken)),
    enabled: Boolean(accessToken),
  })
  const bookQuery = useQuery({
    queryKey: ['onboarding-book', selectedBookId],
    queryFn: () => bookClient.getBook(selectedBookId),
    enabled: Boolean(selectedBookId) && !activePlanQuery.data?.plan,
  })

  if (!selectedBookId && !activePlanQuery.data?.plan) {
    return (
      <main className="app-shell">
        <section className="hero compact" aria-labelledby="onboarding-title">
          <p className="eyebrow">新手引导</p>
          <h1 id="onboarding-title">还没有选择词库</h1>
          <p className="hero-copy">
            先选择一本目标词库，再设置每日新词量和完成日期。
          </p>
          <Link className="primary-action" to="/books">
            选择词库
          </Link>
        </section>
      </main>
    )
  }

  if (activePlanQuery.isPending || bookQuery.isPending) {
    return <p className="route-status">正在准备学习计划…</p>
  }

  if (activePlanQuery.data?.plan) {
    return (
      <main className="app-shell">
        <section className="hero compact" aria-labelledby="active-plan-title">
          <p className="eyebrow">学习计划</p>
          <h1 id="active-plan-title">已有进行中的学习计划</h1>
          <p className="hero-copy">
            {`每日 ${activePlanQuery.data.plan.dailyNewWordTarget} 个新词，系统会继续按这个计划安排学习和复习。`}
          </p>
          <Link className="primary-action" to="/home">
            查看今日任务
          </Link>
        </section>
      </main>
    )
  }

  if (bookQuery.isError) {
    return (
      <main className="app-shell">
        <section className="hero compact" aria-labelledby="book-error-title">
          <p className="eyebrow">新手引导</p>
          <h1 id="book-error-title">词库加载失败</h1>
          <p className="hero-copy">{getErrorMessage(bookQuery.error)}</p>
          <Link className="primary-action" to="/books">
            重新选择词库
          </Link>
        </section>
      </main>
    )
  }

  const book = bookQuery.data?.book

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setApiError(null)

    if (!book || !accessToken) return

    try {
      const values = form.getValues()
      const input = createStudyPlanRequestSchema.parse({
        vocabularyBookId: book.slug,
        learningGoal: values.learningGoal,
        dailyNewWordTarget: Number(values.dailyNewWordTarget),
        dailyReviewLimit: 80,
        targetDate: values.targetDate
          ? new Date(`${values.targetDate}T00:00:00.000Z`).toISOString()
          : null,
        reminderEnabled: values.reminderEnabled,
      })
      await planClient.createPlan(input, accessToken)
      void navigate('/home')
    } catch (error) {
      setApiError(getErrorMessage(error))
    }
  }

  return (
    <main className="onboarding-shell">
      <section className="plan-card" aria-labelledby="onboarding-title">
        <p className="eyebrow">新手引导</p>
        <h1 id="onboarding-title">生成你的学习计划</h1>
        <p className="hero-copy">
          根据词库规模和每日新词量，系统会生成第一个 active 学习计划。
        </p>

        {book ? (
          <div className="selected-book-card">
            <span>已选择词库</span>
            <strong>{book.name}</strong>
            <p>{book.wordCount} 个核心词</p>
          </div>
        ) : null}

        {apiError ? (
          <p className="form-alert" role="alert" aria-label={apiError}>
            {apiError}
          </p>
        ) : null}

        <form
          className="plan-form"
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
        >
          <div className="form-field">
            <label htmlFor="learningGoal">学习目标</label>
            <select id="learningGoal" {...form.register('learningGoal')}>
              <option value="k12">K12 校内考试</option>
              <option value="college">大学考试</option>
              <option value="postgraduate">考研</option>
              <option value="overseas">出国考试</option>
              <option value="workplace">职场提升</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="dailyNewWordTarget">每日新词量</label>
            <input
              id="dailyNewWordTarget"
              type="number"
              min="5"
              max="100"
              inputMode="numeric"
              {...form.register('dailyNewWordTarget', {
                valueAsNumber: true,
              })}
            />
            <p className="field-hint">建议从 30-50 个开始，后续可调整。</p>
          </div>

          <div className="form-field">
            <label htmlFor="targetDate">目标完成日期</label>
            <input
              id="targetDate"
              type="date"
              {...form.register('targetDate')}
            />
            <p className="field-hint">不填写时，系统会按每日新词量自动估算。</p>
          </div>

          <label className="checkbox-field">
            <input type="checkbox" {...form.register('reminderEnabled')} />
            <span>开启学习提醒</span>
          </label>

          <button
            className="primary-action"
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            生成学习计划
          </button>
        </form>
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
