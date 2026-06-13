import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { vocabularyApi, type VocabularyClient } from './api'

type VocabularyBookDetailPageProps = {
  vocabularyApi?: VocabularyClient
}

export function VocabularyBookDetailPage({
  vocabularyApi: client = vocabularyApi,
}: VocabularyBookDetailPageProps) {
  const { bookId } = useParams()
  const detailQuery = useQuery({
    queryKey: ['vocabulary-book', bookId],
    queryFn: () => client.getBook(bookId ?? ''),
    enabled: Boolean(bookId),
  })

  return (
    <main className="book-shell">
      <Link className="text-link" to="/books">
        返回词库列表
      </Link>

      {detailQuery.isPending ? (
        <p className="book-status">正在加载词库详情…</p>
      ) : null}

      {detailQuery.isError ? (
        <section className="book-state-card" role="alert">
          <h1>词库加载失败</h1>
          <p>{messageForError(detailQuery.error)}</p>
          <button
            className="secondary-action"
            type="button"
            onClick={() => void detailQuery.refetch()}
          >
            重新加载详情
          </button>
        </section>
      ) : null}

      {detailQuery.isSuccess ? (
        <section className="book-detail-card" aria-labelledby="book-title">
          <p className="eyebrow">
            {categoryLabel(detailQuery.data.book.category)}
          </p>
          <h1 id="book-title">{detailQuery.data.book.name}</h1>
          <p className="book-detail-count">
            {detailQuery.data.book.wordCount} 个核心词
          </p>
          <p className="hero-copy">{detailQuery.data.book.description}</p>
          <div className="book-detail-meta">
            <span>版本 v{detailQuery.data.book.version}</span>
            <span>服务端词库</span>
            <span>后续会生成每日新词与复习任务</span>
          </div>
          <Link
            className="primary-action"
            to={`/onboarding?book=${detailQuery.data.book.slug}`}
          >
            选择这个词库
          </Link>
        </section>
      ) : null}
    </main>
  )
}

function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    k12: 'K12',
    college: '大学考试',
    postgraduate: '考研',
    overseas: '出国考试',
    workplace: '职场',
  }

  return labels[category] ?? category
}

function messageForError(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return '词库详情加载失败，请稍后重试。'
}
