export function App() {
  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">科学记忆 · 主动回忆 · 智能复习</p>
        <h1 id="hero-title">把单词真正记住</h1>
        <p className="hero-copy">
          用清晰的每日任务，把学习、回忆和复习连成一条完整路径。
        </p>
        <a className="primary-action" href="/login">
          开始学习
        </a>
      </section>
      <nav className="legal-link-row" aria-label="合规链接">
        <a href="/privacy">隐私政策</a>
        <a href="/terms">用户协议</a>
      </nav>
    </main>
  )
}
