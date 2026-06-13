import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { vocabularyApi, type VocabularyClient } from './api'

type VocabularyBooksPageProps = {
  vocabularyApi?: VocabularyClient
}

export function VocabularyBooksPage({
  vocabularyApi: client = vocabularyApi,
}: VocabularyBooksPageProps) {
  const [search, setSearch] = useState('')
  const queryText = useMemo(() => search.trim(), [search])
  const requestInput = useMemo(
    () => (queryText.length > 0 ? { q: queryText } : {}),
    [queryText],
  )
  const booksQuery = useQuery({
    queryKey: ['vocabulary-books', requestInput],
    queryFn: () => client.listBooks(requestInput),
  })

  return (
    <main className="book-shell">
      <section className="book-hero" aria-labelledby="books-title">
        <p className="eyebrow">词库选择</p>
        <h1 id="books-title">选择你的第一本词库</h1>
        <p className="hero-copy">
          先从目标词库开始，后续计划会基于它生成每日新词和复习任务。
        </p>
        <label className="book-search">
          <span>搜索词库</span>
          <input
            type="search"
            value={search}
            placeholder="输入考试、场景或词库名称"
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </section>

      <section className="book-list-panel" aria-live="polite">
        {booksQuery.isPending ? (
          <p className="book-status">正在加载词库…</p>
        ) : null}

        {booksQuery.isError ? (
          <div className="book-state-card" role="alert">
            <h2>词库加载失败</h2>
            <p>{messageForError(booksQuery.error)}</p>
            <button
              className="secondary-action"
              type="button"
              onClick={() => void booksQuery.refetch()}
            >
              重新加载词库
            </button>
          </div>
        ) : null}

        {booksQuery.isSuccess && booksQuery.data.books.length === 0 ? (
          <div className="book-state-card">
            <h2>暂时没有匹配的词库</h2>
            <p>换一个考试名称、学习阶段或使用场景再试试。</p>
          </div>
        ) : null}

        {booksQuery.isSuccess && booksQuery.data.books.length > 0 ? (
          <div className="book-grid">
            {booksQuery.data.books.map((book) => (
              <article className="book-card" key={book.id}>
                <div>
                  <p className="book-category">
                    {categoryLabel(book.category)}
                  </p>
                  <h2>{book.name}</h2>
                  <p>{book.description}</p>
                </div>
                <div className="book-card-footer">
                  <span>{book.wordCount} 词</span>
                  <Link
                    className="primary-action"
                    to={`/books/${book.slug}`}
                    aria-label={`查看 ${book.name}`}
                  >
                    查看详情
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
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
  return '词库加载失败，请稍后重试。'
}
