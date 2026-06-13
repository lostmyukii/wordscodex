import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type {
  ReviewRating,
  StudySession,
  StudySessionResponse,
  SubmitReviewResponse,
} from '@wordscodex/contracts'
import {
  trackAnalyticsEvent,
  type TrackAnalyticsEvent,
} from '../analytics/track-event'
import { useAuthStore } from '../auth/auth-store'
import { studyApi, type StudyClient } from './api'
import { offlineReviewSyncCompletedEventName } from './offline-review-sync'
import {
  studySessionCache,
  type StudySessionCacheClient,
} from './offline-session-cache'
import {
  offlineReviewQueueChangedEventName,
  offlineReviewQueue,
  type OfflineReviewQueueClient,
  type PendingReviewSubmission,
} from './offline-review-queue'

type StudySessionPageProps = {
  studyApi?: StudyClient
  sessionCache?: StudySessionCacheClient
  reviewQueue?: OfflineReviewQueueClient
  trackEvent?: TrackAnalyticsEvent
}

type SyncedReviewResultState = SubmitReviewResponse & {
  pendingSync?: false
  restoredFromServer?: boolean
}

type PendingReviewResultState = {
  pendingSync: true
  idempotencyKey: string
  queuedAt: string
  lastError: string | null
}

type ReviewResultState = SyncedReviewResultState | PendingReviewResultState

export function StudySessionPage({
  studyApi: client = studyApi,
  sessionCache = studySessionCache,
  reviewQueue = offlineReviewQueue,
  trackEvent,
}: StudySessionPageProps) {
  const { sessionId = '' } = useParams()
  const navigate = useNavigate()
  const accessToken = useAuthStore((state) => state.accessToken)
  const reviewStartedAtMs = useRef(Date.now())
  const idempotencyKeys = useRef(new Map<string, string>())
  const [currentIndex, setCurrentIndex] = useState(0)
  const [localReviewResults, setLocalReviewResults] = useState<
    Map<string, ReviewResultState>
  >(() => new Map())
  const [isSyncingPendingReviews, setIsSyncingPendingReviews] = useState(false)
  const [syncPendingReviewsError, setSyncPendingReviewsError] = useState<
    string | null
  >(null)
  const [pendingReviewRefreshKey, setPendingReviewRefreshKey] = useState(0)
  const sessionQuery = useQuery({
    queryKey: ['study-session', sessionId],
    queryFn: () =>
      loadStudySession({
        client,
        sessionCache,
        sessionId,
        accessToken: requireAccessToken(accessToken),
      }),
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

      const idempotencyKey = getIdempotencyKey(
        idempotencyKeys.current,
        input.session.id,
        input.wordId,
      )
      const review = {
        wordId: input.wordId,
        questionType: input.questionType,
        rating: input.rating,
        isCorrect: input.isCorrect,
        responseMs: Math.max(1, Date.now() - reviewStartedAtMs.current),
        answer: input.answer,
        reviewedAt: new Date().toISOString(),
      }
      const sendTrackEvent =
        trackEvent ??
        ((event) =>
          trackAnalyticsEvent({
            ...event,
            accessToken: token,
          }).then(() => undefined))

      return client
        .submitReview(input.session.id, review, idempotencyKey, token)
        .catch(async (error: unknown) => {
          const lastError = getErrorMessage(error)
          const pendingReview = await reviewQueue.enqueue({
            sessionId: input.session.id,
            idempotencyKey,
            review,
            lastError,
          })
          void sendTrackEvent({
            name: 'offline_queue_created',
            properties: {
              pendingCount: 1,
              retryCount: pendingReview.retryCount,
              sessionMode: input.session.mode,
            },
          }).catch(() => undefined)
          dispatchOfflineReviewQueueChanged()

          return toPendingReviewResult(pendingReview)
        })
    },
    onSuccess(result, input) {
      setLocalReviewResults((previous) => {
        const nextResults = new Map(previous)
        nextResults.set(reviewResultKey(input.session.id, input.wordId), result)
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
  const restoredReviewResults = useMemo(() => {
    const nextResults = new Map<string, ReviewResultState>()
    const response = sessionQuery.data?.response
    if (!response) return nextResults

    for (const review of response.reviews) {
      nextResults.set(reviewResultKey(response.session.id, review.wordId), {
        progress: review.progress,
        alreadyProcessed: false,
        restoredFromServer: true,
      })
    }
    return nextResults
  }, [sessionQuery.data])
  const reviewResults = useMemo(() => {
    const nextResults = new Map(restoredReviewResults)
    for (const [key, result] of localReviewResults) {
      nextResults.set(key, result)
    }
    return nextResults
  }, [localReviewResults, restoredReviewResults])
  const pendingReviewCount = useMemo(
    () =>
      [...reviewResults.values()].filter((result) => result.pendingSync).length,
    [reviewResults],
  )

  useEffect(() => {
    const response = sessionQuery.data?.response
    if (!response) return

    let cancelled = false
    void reviewQueue
      .listBySession(response.session.id)
      .then((pendingReviews) => {
        if (cancelled) return
        const restoredWordIds = new Set(
          response.reviews.map((review) => review.wordId),
        )
        const pendingReviewKeys = new Set(
          pendingReviews.map((pendingReview) =>
            reviewResultKey(
              pendingReview.sessionId,
              pendingReview.review.wordId,
            ),
          ),
        )
        setLocalReviewResults((previous) => {
          const nextResults = new Map(previous)
          for (const [key, result] of nextResults) {
            if (!key.startsWith(`${response.session.id}:`)) continue
            if (result.pendingSync && !pendingReviewKeys.has(key)) {
              nextResults.delete(key)
            }
          }
          for (const pendingReview of pendingReviews) {
            if (restoredWordIds.has(pendingReview.review.wordId)) continue
            nextResults.set(
              reviewResultKey(
                pendingReview.sessionId,
                pendingReview.review.wordId,
              ),
              toPendingReviewResult(pendingReview),
            )
          }
          return nextResults
        })
      })

    return () => {
      cancelled = true
    }
  }, [pendingReviewRefreshKey, reviewQueue, sessionQuery.data])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleCompletedSync = () => {
      setPendingReviewRefreshKey((value) => value + 1)
      void sessionQuery.refetch()
    }

    window.addEventListener(
      offlineReviewSyncCompletedEventName,
      handleCompletedSync,
    )

    return () => {
      window.removeEventListener(
        offlineReviewSyncCompletedEventName,
        handleCompletedSync,
      )
    }
  }, [sessionQuery])

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

  const session = sessionQuery.data.response.session
  const sessionModeLabel = getSessionModeLabel(session.mode)
  const currentItem = session.items[currentIndex]
  const currentReviewResult = currentItem
    ? reviewResults.get(reviewResultKey(session.id, currentItem.word.id))
    : null
  const isAnswered = Boolean(currentReviewResult)
  const isLastItem = currentIndex >= session.items.length - 1
  const allItemsAnswered =
    session.items.length > 0 &&
    session.items.every((item) =>
      reviewResults.has(reviewResultKey(session.id, item.word.id)),
    )

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
        {sessionQuery.data.restoredFromLocalCache ? (
          <div className="review-feedback" role="status">
            <strong>已从本地缓存恢复学习会话</strong>
            <span>
              当前显示的是上次已下载的会话；提交作答仍需要联网同步到服务端。
            </span>
          </div>
        ) : null}

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
                <strong>
                  {currentReviewResult.pendingSync
                    ? '作答待同步'
                    : '作答已记录'}
                </strong>
                {currentReviewResult.pendingSync ? (
                  <>
                    <span>
                      已写入本地待同步队列，恢复网络后会用同一个提交键同步。
                    </span>
                    {currentReviewResult.lastError ? (
                      <span>上次错误：{currentReviewResult.lastError}</span>
                    ) : null}
                  </>
                ) : (
                  <>
                    <span>
                      下次复习：
                      {formatDateKey(currentReviewResult.progress.nextReviewAt)}
                    </span>
                    {currentReviewResult.alreadyProcessed ? (
                      <span>这次提交已去重，没有重复累计学习次数。</span>
                    ) : null}
                    {currentReviewResult.restoredFromServer ? (
                      <span>已从服务端恢复作答记录，可继续完成会话。</span>
                    ) : null}
                  </>
                )}
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
            {allItemsAnswered && pendingReviewCount > 0 ? (
              <div className="review-feedback" role="status">
                <strong>还有 {pendingReviewCount} 条作答待同步</strong>
                <span>同步成功后才能完成会话并写入服务端学习结果。</span>
                <button
                  className="primary-action"
                  disabled={isSyncingPendingReviews}
                  type="button"
                  onClick={() => void syncPendingReviews(session)}
                >
                  同步待提交作答
                </button>
                {syncPendingReviewsError ? (
                  <span>{syncPendingReviewsError}</span>
                ) : null}
              </div>
            ) : null}
            {allItemsAnswered && pendingReviewCount === 0 ? (
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

  async function syncPendingReviews(session: StudySession) {
    setIsSyncingPendingReviews(true)
    setSyncPendingReviewsError(null)

    try {
      const token = requireAccessToken(accessToken)
      const pendingReviews = await reviewQueue.listBySession(session.id)

      for (const pendingReview of pendingReviews) {
        try {
          const result = await client.submitReview(
            pendingReview.sessionId,
            pendingReview.review,
            pendingReview.idempotencyKey,
            token,
          )
          await reviewQueue.markSynced(pendingReview.idempotencyKey)
          setLocalReviewResults((previous) => {
            const nextResults = new Map(previous)
            nextResults.set(
              reviewResultKey(
                pendingReview.sessionId,
                pendingReview.review.wordId,
              ),
              result,
            )
            return nextResults
          })
        } catch (error) {
          const message = getErrorMessage(error)
          await reviewQueue.markFailed(pendingReview.idempotencyKey, message)
          setLocalReviewResults((previous) => {
            const nextResults = new Map(previous)
            nextResults.set(
              reviewResultKey(
                pendingReview.sessionId,
                pendingReview.review.wordId,
              ),
              {
                ...toPendingReviewResult(pendingReview),
                lastError: message,
              },
            )
            return nextResults
          })
          throw error
        }
      }
    } catch (error) {
      setSyncPendingReviewsError(getErrorMessage(error))
    } finally {
      setIsSyncingPendingReviews(false)
    }
  }
}

async function loadStudySession(input: {
  client: StudyClient
  sessionCache: StudySessionCacheClient
  sessionId: string
  accessToken: string
}): Promise<{
  response: StudySessionResponse
  restoredFromLocalCache: boolean
}> {
  try {
    const response = await input.client.getSession(
      input.sessionId,
      input.accessToken,
    )
    await input.sessionCache.clearExpired().catch(() => undefined)
    await input.sessionCache.save(response).catch(() => undefined)

    return {
      response,
      restoredFromLocalCache: false,
    }
  } catch (error) {
    const cachedResponse = await input.sessionCache
      .load(input.sessionId)
      .catch(() => null)

    if (cachedResponse) {
      return {
        response: cachedResponse,
        restoredFromLocalCache: true,
      }
    }

    throw error
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

function dispatchOfflineReviewQueueChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(offlineReviewQueueChangedEventName))
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

function reviewResultKey(sessionId: string, wordId: string) {
  return `${sessionId}:${wordId}`
}

function toPendingReviewResult(
  pendingReview: PendingReviewSubmission,
): PendingReviewResultState {
  return {
    pendingSync: true,
    idempotencyKey: pendingReview.idempotencyKey,
    queuedAt: pendingReview.createdAt,
    lastError: pendingReview.lastError,
  }
}

function createRandomId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random()}`
}

function formatDateKey(value: string | null) {
  return value ? value.slice(0, 10) : '待计算'
}
