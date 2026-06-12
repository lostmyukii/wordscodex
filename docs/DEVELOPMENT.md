# 智能词汇学习平台开发文档

> 文档版本：1.0
> 技术方向：React + TypeScript 响应式 Web/PWA
> 首期目标：用最小但完整的产品验证“学习、回忆、复习、反馈、打卡”闭环
> 产品需求来源：[融合版智能词汇学习产品需求分析](../融合版_智能词汇学习产品需求分析.md)

## 1. 文档目的

本文档将产品需求转化为可实施的工程方案，作为 MVP 研发、测试和验收的共同依据。

首期不追求覆盖需求分析中的全部能力，而是优先验证以下假设：

1. 用户能在 3 分钟内完成注册、选词库和生成学习计划；
2. 用户愿意每天完成“到期复习 → 新词学习 → 主动回忆 → 打卡”；
3. 错词会被系统持续追踪，并通过短间隔复习逐步减少；
4. PWA 在手机浏览器中可以提供接近 App 的核心学习体验；
5. 当前架构能够支持未来接入 App、小程序、AI 和教师端，而无需在 MVP 中提前实现这些功能。

## 2. 研发原则

### 2.1 产品原则

- **学习效果优先：** 页面和激励机制服务于记忆，不以延长无效使用时长为目标。
- **主动回忆优先：** 学习流程必须包含用户作答，不能退化为连续翻卡片。
- **今日任务优先：** 首页首先回答“今天还要学什么”，避免信息过载。
- **反馈可解释：** 用户应知道答错原因、掌握状态和下次复习安排。
- **MVP 克制：** P1、P2 功能只有在不增加主流程复杂度时才允许保留接口，不实现空壳页面。

### 2.2 工程原则

- 使用 TypeScript 严格模式，核心业务模型不得使用 `any`。
- 学习调度、掌握度计算等领域逻辑写成无 UI 依赖的纯函数。
- 服务端是学习进度的最终事实来源；本地缓存用于离线体验和待同步操作。
- API 使用稳定的资源标识和幂等行为，避免重复提交学习记录。
- 先完成可测试的端到端纵向闭环，再扩展页面数量。

## 3. MVP 范围

### 3.1 必须实现

| 模块 | MVP 能力 |
|---|---|
| 账户 | 邮箱验证码或手机号验证码登录，访客体验，可补全正式账号 |
| 新手引导 | 选择学习目标、词库、每日新词量和提醒偏好 |
| 词库 | 词库列表、词库详情、词库选择、基础搜索 |
| 学习计划 | 根据词库规模、每日词量和目标日期生成计划 |
| 新词学习 | 单词、音标、发音、释义、例句和可选图片 |
| 主动回忆 | 看词选义、看义选词、拼写输入；听音题在音频资源完整时启用 |
| 基础复习 | 基于回答质量和复习间隔的 SRS v1 调度 |
| 错词本 | 收集答错、犹豫和重复遗忘的词，支持消灭模式 |
| 学习看板 | 今日进度、累计学习、已掌握、待复习、连续打卡和近 7 天趋势 |
| 打卡 | 完成当日最低任务后打卡，展示日历和连续天数 |
| PWA | 可安装、基础静态资源离线、弱网提示、学习操作失败重试 |
| 运营基础 | 词库、单词、释义、例句和音频资源可通过导入脚本维护 |
| 数据埋点 | 覆盖激活、学习、复习、打卡和留存相关核心事件 |

### 3.2 明确不在 MVP

- 好友动态、聊天、学习小组和复杂排行榜；
- 完整家长端、教师端和机构后台；
- 会员订阅、广告换权益和支付；
- AI 个性化例句、AI 造句批改、AI 对话与学习诊断；
- 发音评分和开放式口语识别；
- 用户上传自定义词库；
- 完整 FSRS 参数训练；
- 多语言学习和复杂主题商城。

这些能力只能以稳定接口边界或数据扩展字段的形式预留，不创建无法使用的入口。

## 4. 核心用户流程

### 4.1 首次使用

```text
打开产品
  → 登录或访客体验
  → 选择学习目标
  → 选择词库
  → 设置每日新词量与目标日期
  → 系统生成计划
  → 完成首组新词学习
  → 完成主动回忆
  → 查看学习结果
  → 达到今日要求后打卡
```

### 4.2 日常学习

```text
进入首页
  → 查看今日到期复习和新词数量
  → 优先完成到期复习
  → 学习今日新词
  → 完成混合回忆题
  → 提交学习记录
  → 更新掌握状态和下次复习时间
  → 完成打卡
```

### 4.3 错词消灭

```text
用户答错或反应过慢
  → 记录错误类型与耗时
  → 单词进入错词本
  → 安排更短复习间隔
  → 连续 3 次主动回忆正确
  → 移出高优先级错词队列
  → 返回普通复习计划
```

## 5. 技术方案

### 5.1 推荐技术栈

| 层级 | 技术 | 用途 |
|---|---|---|
| 工作区 | pnpm workspace | 管理 Web、API 和共享包 |
| Web | React 19 + TypeScript + Vite | 响应式 Web/PWA 客户端 |
| 路由 | React Router | 页面路由和登录守卫 |
| 服务端状态 | TanStack Query | API 缓存、重试和失效管理 |
| 客户端状态 | Zustand | 学习会话、离线队列和轻量 UI 状态 |
| 表单 | React Hook Form + Zod | 表单状态与输入校验 |
| 样式 | Tailwind CSS | 设计令牌和响应式布局 |
| PWA | vite-plugin-pwa + Workbox | 安装、缓存和更新策略 |
| 本地数据 | IndexedDB + Dexie | 离线学习包和待同步行为 |
| API | Node.js + TypeScript + Fastify | REST API 和业务服务 |
| 数据访问 | Prisma | 数据模型、迁移和类型安全查询 |
| 数据库 | PostgreSQL | 用户、词库和学习记录 |
| 缓存 | Redis | 验证码、限流和短期任务缓存 |
| 对象存储 | S3 兼容存储 | 图片、音频和导入文件 |
| 测试 | Vitest + Testing Library + Playwright | 单元、组件和端到端测试 |
| 质量 | ESLint + Prettier | 静态检查和格式化 |

React、Vite 等依赖在建项时选择当前稳定版本并锁定版本号。升级必须单独提交，不能与业务功能混在同一变更中。

### 5.2 总体架构

```text
浏览器 / 已安装 PWA
        │
        ├── 静态资源与 Service Worker
        │
        └── HTTPS REST API
                │
          Fastify 应用服务
          ├── 账户与鉴权
          ├── 词库与内容
          ├── 学习计划
          ├── 学习会话
          ├── SRS 调度
          ├── 错词与打卡
          └── 数据看板
                │
        PostgreSQL / Redis / 对象存储
```

MVP 使用模块化单体，不拆微服务。学习调度模块保持纯领域逻辑，未来可以独立扩展，但当前与 API 一起部署。

### 5.3 建议目录结构

```text
.
├── AGENTS.md
├── docs/
│   └── DEVELOPMENT.md
├── apps/
│   ├── web/
│   │   ├── public/
│   │   └── src/
│   │       ├── app/
│   │       ├── components/
│   │       ├── features/
│   │       │   ├── auth/
│   │       │   ├── onboarding/
│   │       │   ├── vocabulary/
│   │       │   ├── study/
│   │       │   ├── review/
│   │       │   ├── mistakes/
│   │       │   ├── dashboard/
│   │       │   └── checkin/
│   │       ├── lib/
│   │       ├── routes/
│   │       ├── stores/
│   │       ├── styles/
│   │       └── test/
│   └── api/
│       ├── prisma/
│       └── src/
│           ├── app/
│           ├── modules/
│           │   ├── auth/
│           │   ├── vocabulary/
│           │   ├── plans/
│           │   ├── study/
│           │   ├── review/
│           │   ├── mistakes/
│           │   ├── checkins/
│           │   └── analytics/
│           └── shared/
├── packages/
│   ├── contracts/
│   ├── domain/
│   └── config/
├── scripts/
│   └── import-vocabulary/
├── pnpm-workspace.yaml
└── package.json
```

`packages/contracts` 存放前后端共享 DTO 和 Zod Schema；`packages/domain` 存放无框架依赖的 SRS、掌握度和计划计算逻辑。

## 6. Web 页面与路由

| 路由 | 页面 | 登录要求 | 主要内容 |
|---|---|---|---|
| `/` | 产品入口 | 否 | 产品价值、开始学习、继续学习 |
| `/login` | 登录 | 否 | 验证码登录、访客入口 |
| `/onboarding` | 新手引导 | 是 | 目标、词库、每日词量和目标日期 |
| `/home` | 今日首页 | 是 | 到期复习、新词任务、连续打卡和快捷入口 |
| `/books` | 词库列表 | 是 | 分类、搜索、进度和切换 |
| `/books/:bookId` | 词库详情 | 是 | 词数、预计完成时间和计划设置 |
| `/study/session/:sessionId` | 学习会话 | 是 | 新词卡片、回忆题和进度 |
| `/study/result/:sessionId` | 学习结果 | 是 | 正确率、错词、耗时和奖励 |
| `/mistakes` | 错词本 | 是 | 错误类型、最近错误和消灭模式 |
| `/dashboard` | 学习看板 | 是 | 近 7 天趋势、词库进度和掌握状态 |
| `/checkin` | 打卡日历 | 是 | 今日状态、连续天数和历史日历 |
| `/settings` | 设置 | 是 | 学习计划、提醒、音频和数据设置 |
| `/offline` | 离线提示 | 否 | 网络状态、可用离线能力和重试 |

### 6.1 响应式要求

- 以 375px 宽手机屏幕作为主要设计基准；
- 学习页在桌面端保持聚焦列，正文最大宽度建议为 720px；
- 关键操作按钮的可点击区域不小于 44×44px；
- 不以悬停作为唯一交互方式；
- 学习流程不得因键盘弹出遮挡输入框或提交按钮；
- 支持系统深色模式，但 MVP 可先交付完整浅色主题。

## 7. 核心领域模型

### 7.1 主要实体

#### User

```ts
type User = {
  id: string
  email: string | null
  phone: string | null
  displayName: string
  role: 'learner' | 'admin'
  timezone: string
  createdAt: string
}
```

#### VocabularyBook

```ts
type VocabularyBook = {
  id: string
  slug: string
  name: string
  category: 'k12' | 'college' | 'postgraduate' | 'overseas' | 'workplace'
  description: string
  wordCount: number
  version: number
  publishedAt: string | null
}
```

#### Word

```ts
type Word = {
  id: string
  lemma: string
  phoneticUk: string | null
  phoneticUs: string | null
  audioUkUrl: string | null
  audioUsUrl: string | null
  imageUrl: string | null
  meanings: Array<{
    partOfSpeech: string
    definitionZh: string
    definitionEn: string | null
  }>
  examples: Array<{
    sentence: string
    translationZh: string
    source: string | null
  }>
}
```

#### StudyPlan

```ts
type StudyPlan = {
  id: string
  userId: string
  vocabularyBookId: string
  dailyNewWordTarget: number
  dailyReviewLimit: number
  targetDate: string | null
  status: 'active' | 'paused' | 'completed'
  startedAt: string
}
```

#### UserWordProgress

```ts
type MasteryState =
  | 'new'
  | 'learning'
  | 'fuzzy'
  | 'mistake'
  | 'mastered'
  | 'lapsed'

type UserWordProgress = {
  userId: string
  wordId: string
  masteryState: MasteryState
  repetitions: number
  consecutiveCorrect: number
  correctCount: number
  incorrectCount: number
  easeFactor: number
  intervalDays: number
  lastReviewedAt: string | null
  nextReviewAt: string | null
  averageResponseMs: number | null
  lastErrorType: 'meaning' | 'spelling' | 'listening' | 'context' | null
  updatedAt: string
}
```

#### StudySession 与 ReviewLog

```ts
type StudySession = {
  id: string
  userId: string
  mode: 'new_words' | 'review' | 'mistake_drill' | 'mixed'
  status: 'active' | 'completed' | 'abandoned'
  startedAt: string
  completedAt: string | null
}

type ReviewRating = 'again' | 'hard' | 'good' | 'easy'

type ReviewLog = {
  id: string
  idempotencyKey: string
  sessionId: string
  userId: string
  wordId: string
  questionType: 'word_to_meaning' | 'meaning_to_word' | 'spelling' | 'listening'
  rating: ReviewRating
  isCorrect: boolean
  responseMs: number
  answer: string | null
  reviewedAt: string
}
```

### 7.2 数据约束

- `ReviewLog.idempotencyKey` 全局唯一，客户端重试不得生成重复学习记录；
- 同一用户只能有一个 `active` 学习计划；
- `nextReviewAt` 使用 UTC 存储，按用户时区展示；
- 单词内容通过版本管理更新，不直接覆盖历史学习记录；
- 学习结果写入和进度调度必须在同一个数据库事务中完成；
- 删除账号时按隐私要求删除或匿名化个人数据，统计数据不得保留可反查标识。

## 8. SRS v1 调度规则

MVP 使用可解释的基础 SRS，不宣称完整 FSRS。算法位于 `packages/domain`，客户端只展示服务端计算结果。

### 8.1 回答等级

| 等级 | 判定 |
|---|---|
| `again` | 答错，或用户主动选择“不认识” |
| `hard` | 答对但明显犹豫、使用提示，或响应超过题型阈值 |
| `good` | 正常速度答对 |
| `easy` | 快速且无提示答对 |

题型阈值通过配置维护，默认值：

- 选择题：`hard` 阈值 8 秒；
- 拼写题：`hard` 阈值 15 秒；
- 听音题：`hard` 阈值 10 秒。

### 8.2 初始间隔

| 结果 | 下次复习 |
|---|---|
| `again` | 10 分钟后 |
| `hard` | 1 天后 |
| `good` | 2 天后 |
| `easy` | 4 天后 |

### 8.3 后续间隔

```text
again: interval = 10 分钟，连续正确归零，状态进入 mistake
hard:  interval = max(1 天, 旧间隔 × 1.2)
good:  interval = max(2 天, 旧间隔 × easeFactor)
easy:  interval = max(4 天, 旧间隔 × easeFactor × 1.3)
```

`easeFactor` 初始为 `2.3`，范围限制在 `1.3` 到 `3.0`：

- `again`：减少 `0.20`；
- `hard`：减少 `0.10`；
- `good`：不变；
- `easy`：增加 `0.10`。

### 8.4 掌握状态

- 第一次接触前为 `new`；
- 完成新词学习但稳定度不足为 `learning`；
- 答对但超过 `hard` 阈值为 `fuzzy`；
- 答错或最近 5 次中答错至少 2 次为 `mistake`；
- 连续正确至少 3 次且间隔达到 14 天为 `mastered`；
- 已掌握单词再次答错为 `lapsed`，并进入错词复习；
- `lapsed` 连续正确 3 次后返回 `learning` 或 `mastered`，由当前间隔决定。

## 9. API 设计

### 9.1 通用约定

- API 前缀：`/api/v1`；
- 传输格式：JSON；
- 身份认证：短期访问令牌 + HttpOnly、Secure 刷新 Cookie；
- 所有写接口验证 `Content-Type`、请求体和权限；
- 分页使用游标，不依赖易漂移的页码；
- 错误返回稳定的业务代码，不向客户端暴露数据库错误；
- 学习记录提交必须携带 `Idempotency-Key`。

标准错误：

```json
{
  "error": {
    "code": "STUDY_SESSION_EXPIRED",
    "message": "当前学习会话已失效，请重新开始。",
    "requestId": "req_123"
  }
}
```

### 9.2 MVP 端点

#### 账户与用户

```text
POST   /api/v1/auth/request-code
POST   /api/v1/auth/verify-code
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/me
PATCH  /api/v1/me/preferences
```

#### 词库与计划

```text
GET    /api/v1/vocabulary-books
GET    /api/v1/vocabulary-books/:bookId
POST   /api/v1/study-plans
GET    /api/v1/study-plans/active
PATCH  /api/v1/study-plans/:planId
```

#### 今日任务与学习

```text
GET    /api/v1/today
POST   /api/v1/study-sessions
GET    /api/v1/study-sessions/:sessionId
POST   /api/v1/study-sessions/:sessionId/reviews
POST   /api/v1/study-sessions/:sessionId/complete
GET    /api/v1/study-sessions/:sessionId/result
```

创建会话请求：

```json
{
  "mode": "mixed",
  "newWordLimit": 10,
  "reviewLimit": 30
}
```

提交作答请求：

```json
{
  "wordId": "word_123",
  "questionType": "spelling",
  "rating": "good",
  "isCorrect": true,
  "responseMs": 6420,
  "answer": "context",
  "reviewedAt": "2026-06-12T02:30:00.000Z"
}
```

服务端返回更新后的调度结果：

```json
{
  "progress": {
    "masteryState": "learning",
    "consecutiveCorrect": 2,
    "intervalDays": 4,
    "nextReviewAt": "2026-06-16T02:30:00.000Z"
  }
}
```

#### 错词、看板和打卡

```text
GET    /api/v1/mistakes
POST   /api/v1/mistakes/session
GET    /api/v1/dashboard/summary
GET    /api/v1/dashboard/trends?days=7
GET    /api/v1/checkins
POST   /api/v1/checkins
```

## 10. 学习会话设计

### 10.1 会话生成

1. 读取用户当前计划；
2. 查询 `nextReviewAt <= now` 的到期单词；
3. 按 `mistake → lapsed → fuzzy → learning → mastered` 排序；
4. 在每日上限内加入复习词；
5. 若用户选择混合模式，再加入当天尚未学习的新词；
6. 对同一个词生成一种主要题型，错词可以在会话末尾追加一次不同题型；
7. 固化会话题目顺序，刷新页面后保持一致。

### 10.2 完成条件

- 所有题目均产生有效回答；
- 作答记录成功同步到服务端；
- 会话被标记为 `completed`；
- 当天完成至少 1 个学习或复习会话后允许打卡；
- 网络中断时显示“待同步”，不能把本地完成误报成服务端已完成。

## 11. PWA 与离线策略

### 11.1 缓存分层

| 内容 | 策略 |
|---|---|
| 应用壳、字体、图标 | Cache First，版本变化时更新 |
| 用户和今日任务 API | Network First，失败时读取最近缓存 |
| 词库元数据 | Stale While Revalidate |
| 当前学习包 | 用户主动开始会话时写入 IndexedDB |
| 图片与音频 | Cache First，设置容量和过期清理 |
| 作答记录 | 先写本地队列，再幂等提交服务端 |

### 11.2 离线能力边界

离线时允许：

- 打开已缓存的应用；
- 查看最近一次今日任务；
- 继续已下载且未过期的学习会话；
- 将作答暂存到本地同步队列。

离线时不允许：

- 创建新计划；
- 切换未缓存词库；
- 生成新的服务端学习会话；
- 将打卡显示为最终成功。

恢复网络后按创建时间提交队列。连续失败采用指数退避；鉴权失效时暂停同步并引导重新登录。

## 12. 内容导入与质量

词库数据通过版本化脚本导入，不在生产数据库中手工编辑。

最小导入格式：

```csv
book_slug,lemma,part_of_speech,definition_zh,phonetic_us,audio_us_url,example,example_zh
cet4,context,n.,上下文；语境,/ˈkɑːntekst/,https://cdn.example.com/context.mp3,Use the word in context.,在语境中使用这个单词。
```

导入前必须校验：

- `lemma` 非空且格式合法；
- 同一词库内单词不重复；
- 每个词至少有一个中文释义；
- 音频、图片 URL 使用 HTTPS；
- 例句包含目标词或其合法词形；
- 导入生成明确的新增、更新、跳过和失败统计；
- 资源版权来源可追踪。

## 13. 安全与合规

- 生产环境只使用 HTTPS；
- 验证码、登录和学习提交接口必须限流；
- 刷新令牌不写入 `localStorage`；
- 密钥仅通过环境变量注入，不进入仓库；
- 日志不得记录验证码、令牌、完整手机号或邮箱；
- 未成年人默认关闭陌生人社交能力，MVP 不实现公开社交；
- 提供隐私政策、用户协议、账号注销和数据删除入口；
- AI 功能进入研发前必须补充内容安全、成本和未成年人保护方案；
- 图片、音频、例句和词库必须保留授权或来源记录。

## 14. 可观测性与埋点

### 14.1 关键事件

```text
auth_completed
onboarding_started
onboarding_completed
book_selected
plan_created
study_session_started
review_answered
study_session_completed
mistake_drill_started
mistake_removed
checkin_completed
pwa_install_prompt_shown
pwa_installed
offline_queue_created
offline_queue_synced
```

事件只记录分析所需字段，不上传用户完整答案文本，除非产品明确需要且已完成隐私评估。

### 14.2 MVP 指标

| 指标 | 定义 | 目标 |
|---|---|---|
| 首次学习完成率 | 注册后 24 小时内完成首个会话的用户占比 | ≥ 70% |
| 次日留存 | 首次学习次日再次完成有效行为 | ≥ 35% |
| 7 日留存 | 首次学习后第 7 日再次完成有效行为 | ≥ 18% |
| 每日任务完成率 | 当日完成计划任务的活跃用户占比 | ≥ 50% |
| 错词复习完成率 | 启动错词任务并完成的会话占比 | ≥ 60% |
| 同步成功率 | 作答记录在 24 小时内同步成功的占比 | ≥ 99.5% |

## 15. 测试策略

### 15.1 单元测试

必须覆盖：

- SRS 各等级的间隔计算；
- `easeFactor` 上下界；
- 掌握状态转换；
- 今日任务排序和每日上限；
- 目标日期与每日新词量计算；
- 连续打卡跨时区和断签逻辑；
- 离线队列去重与重试。

### 15.2 组件测试

重点覆盖：

- 单词卡片内容和音频状态；
- 选择题、拼写题的提交与反馈；
- 学习进度在刷新后恢复；
- 网络错误、空状态和加载状态；
- 键盘操作及基础可访问性。

### 15.3 API 集成测试

重点覆盖：

- 未登录访问被拒绝；
- 重复 `Idempotency-Key` 不会重复更新进度；
- 学习记录和调度结果事务一致；
- 用户不能访问其他用户的计划和会话；
- 词库版本更新不会破坏历史进度；
- 打卡条件由服务端验证。

### 15.4 端到端测试

至少包含：

1. 新用户完成引导和首次学习；
2. 老用户完成到期复习并打卡；
3. 答错单词进入错词本并完成消灭训练；
4. 学习途中刷新页面后恢复会话；
5. 离线作答后恢复网络并成功同步；
6. 手机视口下完成拼写题且按钮不被软键盘遮挡。

## 16. 性能与可访问性

### 16.1 性能预算

- 移动网络下首页 LCP 目标小于 2.5 秒；
- 学习卡片切换交互响应目标小于 200ms；
- 首屏 JavaScript gzip 后建议不超过 250KB；
- 非首屏页面按路由懒加载；
- 图片使用现代格式和明确尺寸，避免布局抖动；
- 音频按需加载，不在首页预载整套词库；
- 大型词库不一次性写入浏览器内存。

### 16.2 可访问性

- 文本和背景对比度达到 WCAG 2.1 AA；
- 交互元素可通过键盘完成；
- 答题正误不能只用颜色表示；
- 音频播放提供文字内容或释义辅助；
- 动画遵循 `prefers-reduced-motion`；
- 表单错误与输入框建立可读关联；
- 页面标题和主标题随路由正确更新。

## 17. 环境与配置

建议环境：

```text
local       本地开发
test        自动化测试
staging     集成验收与内容审核
production  正式环境
```

环境变量命名示例：

```text
DATABASE_URL
REDIS_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
OBJECT_STORAGE_ENDPOINT
OBJECT_STORAGE_BUCKET
OBJECT_STORAGE_ACCESS_KEY
OBJECT_STORAGE_SECRET_KEY
WEB_ORIGIN
API_ORIGIN
```

仓库仅提交 `.env.example`，其中使用无敏感性的示例值。

## 18. 研发阶段与交付标准

### 阶段 0：工程基线

- 建立 pnpm workspace；
- 创建 Web、API、共享 contracts 和 domain 包；
- 配置 TypeScript、ESLint、Prettier、Vitest 和 CI；
- 建立 PostgreSQL 本地开发环境和首个迁移；
- 完成 PWA 应用壳和健康检查。

验收：全新环境按照 README 可启动，检查、测试和构建命令全部通过。

### 阶段 1：首次学习闭环

- 登录与用户资料；
- 词库列表和详情；
- 新手引导与学习计划；
- 今日首页；
- 新词学习、基础题型和学习结果。

验收：新用户可从登录连续完成首个学习会话，数据在刷新后保留。

### 阶段 2：复习与错词闭环

- SRS v1；
- 到期复习队列；
- 错词本和消灭模式；
- 幂等学习记录；
- 学习会话恢复。

验收：回答会改变掌握状态和下次复习时间，重复请求不会重复计数。

### 阶段 3：反馈、打卡与 PWA

- 学习看板；
- 打卡日历；
- 埋点；
- PWA 安装；
- 学习包缓存和离线同步队列。

验收：可在手机浏览器安装；短时断网后可继续已开始会话并在恢复网络后同步。

### 阶段 4：上线准备

- 性能和可访问性检查；
- 安全、限流和日志脱敏；
- 内容导入校验；
- 数据备份和恢复演练；
- staging 端到端验收；
- 隐私政策、用户协议和注销流程。

验收：关键端到端用例通过，无高危安全问题，核心指标事件可查询。

## 19. MVP 完成定义

只有同时满足以下条件，MVP 才视为完成：

- 必须实现范围中的功能均可在手机和桌面浏览器使用；
- 核心学习流程不存在阻断性错误；
- SRS 规则与本文一致并有单元测试；
- 学习记录支持幂等提交和失败恢复；
- 离线边界清晰，不向用户展示错误的同步状态；
- 测试、类型检查、Lint 和生产构建全部通过；
- 关键页面满足性能预算和基础无障碍要求；
- 词库内容通过导入校验并具有版权来源记录；
- staging 环境完成一次完整的新用户与老用户验收；
- 上线后可以观测激活、留存、学习效果和同步成功率。

## 20. 后续演进

MVP 数据验证达标后，按以下顺序评估扩展：

1. 游戏化等级、徽章和轻量排行榜；
2. AI 个性化例句，并建立内容质量评估集；
3. 用户自定义词库与内容审核；
4. 家长周报和轻量教师任务；
5. 将 SRS v1 升级为 FSRS，并使用真实复习数据校准参数；
6. AI 造句批改、对话练习和学习诊断；
7. 独立 App、小程序和机构端。

每项扩展都应先补充独立设计文档、验收指标和成本评估，不能仅依据“竞品已有”进入开发。
