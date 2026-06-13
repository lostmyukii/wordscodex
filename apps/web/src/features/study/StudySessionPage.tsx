import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { useAuthStore } from '../auth/auth-store'
import { studyApi, type StudyClient } from './api'

type StudySessionPageProps = {
  studyApi?: StudyClient
}

export function StudySessionPage({
  studyApi: client = studyApi,
}: StudySessionPageProps) {
  const { sessionId = '' } = useParams()
  const accessToken = useAuthStore((state) => state.accessToken)
  const sessionQuery = useQuery({
    queryKey: ['study-session', sessionId],
    queryFn: () =>
      client.getSession(sessionId, requireAccessToken(accessToken)),
    enabled: Boolean(accessToken) && sessionId.length > 0,
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
  const currentItem = session.items[0]

  return (
    <main className="study-shell">
      <section className="study-card" aria-labelledby="session-title">
        <p className="eyebrow">学习会话</p>
        <h1 id="session-title">学习会话</h1>
        <p className="hero-copy">
          {session.mode === 'new_words' ? '新词学习' : '学习任务'} · 共{' '}
          {session.items.length} 题 · 当前会话已由服务端固化
        </p>

        {currentItem ? (
          <article className="word-card" aria-label="当前单词">
            <div className="session-progress">
              第 {currentItem.position} / {session.items.length} 题
            </div>
            <h2>{currentItem.word.lemma}</h2>
            <div className="phonetic-row">
              {uniquePhonetics(
                currentItem.word.phoneticUk,
                currentItem.word.phoneticUs,
              ).map((phonetic) => (
                <span key={phonetic}>{phonetic}</span>
              ))}
            </div>
            <div className="meaning-list">
              {currentItem.word.meanings.map((meaning) => (
                <p key={`${meaning.partOfSpeech}-${meaning.definitionZh}`}>
                  <strong>{meaning.partOfSpeech}</strong> {meaning.definitionZh}
                </p>
              ))}
            </div>
            {currentItem.word.examples[0] ? (
              <blockquote className="example-card">
                <p>{currentItem.word.examples[0].sentence}</p>
                <footer>{currentItem.word.examples[0].translationZh}</footer>
              </blockquote>
            ) : null}
            <p className="field-hint">
              下一步会把这里升级为主动回忆题，并写入 ReviewLog。
            </p>
          </article>
        ) : (
          <p className="empty-note">这个会话暂时没有题目。</p>
        )}
      </section>
    </main>
  )
}

function uniquePhonetics(...values: Array<string | null>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
}

function requireAccessToken(accessToken: string | null) {
  if (!accessToken) throw new Error('登录状态已失效，请重新登录。')
  return accessToken
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请稍后重试。'
}
