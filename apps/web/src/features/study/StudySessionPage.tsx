import { useMutation, useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { ReviewRating, StudySession } from '@wordscodex/contracts'
import { useAuthStore } from '../auth/auth-store'
import { studyApi, type StudyClient } from './api'

type StudySessionPageProps = {
  studyApi?: StudyClient
}

export function StudySessionPage({
  studyApi: client = studyApi,
}: StudySessionPageProps) {
  const { sessionId = '' } = useParams()
  const navigate = useNavigate()
  const accessToken = useAuthStore((state) => state.accessToken)
  const reviewStartedAtMs = useRef(Date.now())
  const idempotencyKeys = useRef(new Map<string, string>())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [reviewResults, setReviewResults] = useState<
    Map<string, Awaited<ReturnType<StudyClient['submitReview']>>>
  >(() => new Map())
  const sessionQuery = useQuery({
    queryKey: ['study-session', sessionId],
    queryFn: () =>
      client.getSession(sessionId, requireAccessToken(accessToken)),
    enabled: Boolean(accessToken) && sessionId.length > 0,
  })
  const submitReviewMutation = useMutation({
    mutationFn: (input: {
      session: StudySession
      wordId: string
      questionType: StudySession['items'][number]['questionType']
      rating: ReviewRating
      isCorrect: boolean
      answer: string
    }) => {
      const token = requireAccessToken(accessToken)

      return client.submitReview(
        input.session.id,
        {
          wordId: input.wordId,
          questionType: input.questionType,
          rating: input.rating,
          isCorrect: input.isCorrect,
          responseMs: Math.max(1, Date.now() - reviewStartedAtMs.current),
          answer: input.answer,
          reviewedAt: new Date().toISOString(),
        },
        getIdempotencyKey(
          idempotencyKeys.current,
          input.session.id,
          input.wordId,
        ),
        token,
      )
    },
    onSuccess(result, input) {
      setReviewResults((previous) => {
        const nextResults = new Map(previous)
        nextResults.set(input.wordId, result)
        return nextResults
      })
    },
  })
  const completeSessionMutation = useMutation({
    mutationFn: (targetSessionId: string) =>
      client.completeSession(targetSessionId, requireAccessToken(accessToken)),
    onSuccess(response) {
      void navigate(`/study/result/${response.session.id}`)
    },
  })

  if (sessionQuery.isPending) {
    return <p className="route-status">正在加载学习会话…</p>
  }

  if (sessionQuery.isError) {
    return (
      <main className="app-shell">
        <section className="hero compact" aria-labelledby="session-error-title">
          <p className="eyebrow">学习会话</p>
          <h1 id="session-error-title">学习会话加载失败</h1>
          <p className="hero-copy">{getErrorMessage(sessionQuery.error)}</p>
          <Link className="primary-action" to="/home">
            返回今日任务
          </Link>
        </section>
      </main>
    )
  }

  const session = sessionQuery.data.session
  const sessionModeLabel = getSessionModeLabel(session.mode)
  const currentItem = session.items[currentIndex]
  const currentReviewResult = currentItem
    ? reviewResults.get(currentItem.word.id)
    : null
  const isAnswered = Boolean(currentReviewResult)
  const isLastItem = currentIndex >= session.items.length - 1
  const allItemsAnswered =
    session.items.length > 0 &&
    session.items.every((item) => reviewResults.has(item.word.id))

  return (
    <main className="study-shell">
      <section className="study-card" aria-labelledby="session-title">
        <p className="eyebrow">学习会话</p>
        <h1 id="session-title">学习会话</h1>
        <p className="hero-copy">
          {sessionModeLabel} · 共 {session.items.length} 题 · 已答{' '}
          {reviewResults.size} 题 ·
          {session.status === 'completed' ? ' 服务端已固化' : ' 当前会话进行中'}
        </p>

        {currentItem ? (
          <article className="word-card" aria-label="主动回忆题">
            <div className="session-progress">
              第 {currentItem.position} / {session.items.length} 题
            </div>
            <h2>{currentItem.word.lemma} 的中文意思是？</h2>
            <div className="phonetic-row">
              {uniquePhonetics(
                currentItem.word.phoneticUk,
                currentItem.word.phoneticUs,
              ).map((phonetic) => (
                <span key={phonetic}>{phonetic}</span>
              ))}
            </div>
            <p className="field-hint">
              先在心里说出释义，再选择最接近的回忆状态。提交后会写入 ReviewLog
              并更新下次复习时间。
            </p>
            <div className="answer-actions" aria-label="选择回答结果">
              <button
                className="secondary-action"
                disabled={submitReviewMutation.isPending || isAnswered}
                type="button"
                onClick={() =>
                  submitCurrentReview({
                    session,
                    wordId: currentItem.word.id,
                    questionType: currentItem.questionType,
                    rating: 'again',
                    isCorrect: false,
                    answer: '不认识',
                  })
                }
              >
                不认识
              </button>
              <button
                className="secondary-action"
                disabled={submitReviewMutation.isPending || isAnswered}
                type="button"
                onClick={() =>
                  submitCurrentReview({
                    session,
                    wordId: currentItem.word.id,
                    questionType: currentItem.questionType,
                    rating: 'hard',
                    isCorrect: true,
                    answer: '有点模糊',
                  })
                }
              >
                有点模糊
              </button>
              <button
                className="primary-action"
                disabled={submitReviewMutation.isPending || isAnswered}
                type="button"
                onClick={() =>
                  submitCurrentReview({
                    session,
                    wordId: currentItem.word.id,
                    questionType: currentItem.questionType,
                    rating: 'good',
                    isCorrect: true,
                    answer: '认识',
                  })
                }
              >
                认识
              </button>
              <button
                className="secondary-action"
                disabled={submitReviewMutation.isPending || isAnswered}
                type="button"
                onClick={() =>
                  submitCurrentReview({
                    session,
                    wordId: currentItem.word.id,
                    questionType: currentItem.questionType,
                    rating: 'easy',
                    isCorrect: true,
                    answer: '很轻松',
                  })
                }
              >
                很轻松
              </button>
            </div>
            {submitReviewMutation.isError ? (
              <p className="form-alert">
                {getErrorMessage(submitReviewMutation.error)}
              </p>
            ) : null}
            {currentReviewResult ? (
              <div className="review-feedback" role="status">
                <strong>作答已记录</strong>
                <span>
                  下次复习：
                  {formatDateKey(currentReviewResult.progress.nextReviewAt)}
                </span>
                {currentReviewResult.alreadyProcessed ? (
                  <span>这次提交已去重，没有重复累计学习次数。</span>
                ) : null}
              </div>
            ) : null}
            {completeSessionMutation.isError ? (
              <p className="form-alert">
                {getErrorMessage(completeSessionMutation.error)}
              </p>
            ) : null}
            {isAnswered ? (
              <>
                <div className="meaning-list">
                  {currentItem.word.meanings.map((meaning) => (
                    <p key={`${meaning.partOfSpeech}-${meaning.definitionZh}`}>
                      <strong>{meaning.partOfSpeech}</strong>{' '}
                      {meaning.definitionZh}
                    </p>
                  ))}
                </div>
                {currentItem.word.examples[0] ? (
                  <blockquote className="example-card">
                    <p>{currentItem.word.examples[0].sentence}</p>
                    <footer>
                      {currentItem.word.examples[0].translationZh}
                    </footer>
                  </blockquote>
                ) : null}
                {!isLastItem ? (
                  <button
                    className="primary-action"
                    type="button"
                    onClick={goToNextItem}
                  >
                    下一题
                  </button>
                ) : null}
              </>
            ) : null}
            {allItemsAnswered ? (
              <>
                <button
                  className="primary-action"
                  disabled={completeSessionMutation.isPending}
                  type="button"
                  onClick={() => completeSessionMutation.mutate(session.id)}
                >
                  完成会话
                </button>
              </>
            ) : null}
          </article>
        ) : (
          <p className="empty-note">这个会话暂时没有题目。</p>
        )}
      </section>
    </main>
  )

  function submitCurrentReview(input: {
    session: StudySession
    wordId: string
    questionType: StudySession['items'][number]['questionType']
    rating: ReviewRating
    isCorrect: boolean
    answer: string
  }) {
    submitReviewMutation.mutate(input)
  }

  function goToNextItem() {
    setCurrentIndex((value) => Math.min(value + 1, session.items.length - 1))
    reviewStartedAtMs.current = Date.now()
  }
}

function uniquePhonetics(...values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function getSessionModeLabel(mode: StudySession['mode']) {
  switch (mode) {
    case 'new_words':
      return '新词学习'
    case 'review':
      return '到期复习'
    case 'mixed':
      return '混合学习'
    case 'mistake_drill':
      return '错词强化'
  }
}

function requireAccessToken(accessToken: string | null) {
  if (!accessToken) throw new Error('登录状态已失效，请重新登录。')
  return accessToken
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试。'
}

function getIdempotencyKey(
  idempotencyKeys: Map<string, string>,
  sessionId: string,
  wordId: string,
) {
  const key = `${sessionId}_${wordId}`
  const existingKey = idempotencyKeys.get(key)
  if (existingKey) return existingKey

  const nextKey = `review_${sessionId}_${wordId}_${createRandomId()}`
  idempotencyKeys.set(key, nextKey)
  return nextKey
}

function createRandomId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random()}`
}

function formatDateKey(value: string | null) {
  return value ? value.slice(0, 10) : '待计算'
}
