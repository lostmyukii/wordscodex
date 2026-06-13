import { Link } from 'react-router-dom'

export function OnboardingEntryPage() {
  return (
    <main className="app-shell">
      <section className="hero compact" aria-labelledby="onboarding-title">
        <p className="eyebrow">新手引导</p>
        <h1 id="onboarding-title">开始制定学习计划</h1>
        <p className="hero-copy">
          下一步会选择学习目标和词库，再设置每日新词量与完成日期。
        </p>
        <Link className="primary-action" to="/books">
          选择词库
        </Link>
      </section>
    </main>
  )
}
