import { Link } from 'react-router-dom'
import { useEffect } from 'react'

type LegalPageProps = {
  kind: 'privacy' | 'terms'
}

const legalContent = {
  privacy: {
    title: '隐私政策',
    eyebrow: '数据最小化 · 可撤回 · 可删除',
    updatedAt: '2026-06-13',
    intro:
      'Wordscodex 只收集智能词汇学习所需的最小数据，并把学习进度、离线同步和账号注销边界说清楚。',
    sections: [
      {
        heading: '我们收集什么',
        body: '我们会保存账号标识、学习计划、学习记录、打卡和同步状态，用于安排主动回忆、SRS 复习、错词强化和跨设备恢复。',
      },
      {
        heading: '我们如何保护数据',
        body: '刷新令牌只通过 HttpOnly Cookie 保存；日志不会记录验证码、令牌、完整邮箱或敏感认证信息；离线数据只用于恢复当前学习会话和待同步作答。',
      },
      {
        heading: '你可以删除什么',
        body: '你可以在账号注销入口删除账号。注销后，学习计划、学习记录、打卡记录和登录会话会被删除，分析事件会断开用户标识用于不可反查的聚合统计。',
      },
    ],
  },
  terms: {
    title: '用户协议',
    eyebrow: '真实学习 · 内容合规 · 稳定服务',
    updatedAt: '2026-06-13',
    intro:
      '使用 Wordscodex 表示你理解本产品围绕主动回忆、SRS 复习和错词强化提供学习服务。',
    sections: [
      {
        heading: '学习服务边界',
        body: '平台会根据你的作答结果安排复习，但学习效果取决于真实作答、持续练习和按计划完成每日任务。',
      },
      {
        heading: '内容来源',
        body: '词库、例句、音频和图片需要有可追踪来源。你不得上传或传播侵犯他人权利、违法或不适合未成年人的内容。',
      },
      {
        heading: '账号责任',
        body: '你需要保护自己的登录方式，不得恶意刷请求、绕过同步限制或破坏他人学习数据。',
      },
    ],
  },
} as const

export function LegalPage({ kind }: LegalPageProps) {
  const content = legalContent[kind]

  useEffect(() => {
    document.title = `${content.title} · Wordscodex`
  }, [content.title])

  return (
    <main className="legal-shell">
      <article className="legal-card" aria-labelledby="legal-title">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1 id="legal-title">{content.title}</h1>
        <p className="legal-updated">更新日期：{content.updatedAt}</p>
        <p className="hero-copy">{content.intro}</p>

        <div className="legal-section-list">
          {content.sections.map((section) => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              <p>{section.body}</p>
            </section>
          ))}
        </div>

        <div className="legal-actions">
          <Link className="secondary-action" to="/">
            返回首页
          </Link>
          <Link className="secondary-action" to="/account/delete">
            账号注销
          </Link>
        </div>
      </article>
    </main>
  )
}
