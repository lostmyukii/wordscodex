# Stage 1 今日任务与学习会话骨架实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把已创建的 active 学习计划推进到可进入的今日任务和首个新词学习会话。

**Architecture:** 服务端仍是最终事实来源：`GET /api/v1/today` 返回今日任务摘要，`POST /api/v1/study-sessions` 固化本次学习会话题目顺序，`GET /api/v1/study-sessions/:sessionId` 支持刷新恢复。前端只展示服务端返回的任务与会话，不自行计算调度规则。

**Tech Stack:** Prisma + Fastify + Zod contracts + React Router + TanStack Query + Vitest + Playwright。

---

## 范围

- 新增最小可用词条数据表与 seed 样例词，支撑首个新词会话。
- 新增 `UserWordProgress`、`StudySession`、`StudySessionItem` 数据骨架，为下一步 ReviewLog 和 SRS 写入留出结构。
- 新增今日任务排序纯函数，覆盖复习优先、新词上限和空任务。
- 新增共享 contracts：`Word`、`TodayResponse`、`StudySession`、创建会话请求/响应。
- 新增 API：`GET /api/v1/today`、`POST /api/v1/study-sessions`、`GET /api/v1/study-sessions/:sessionId`。
- 更新 `/home`：展示 active plan、今日新词/复习任务、开始学习按钮、加载/错误/空状态。
- 新增 `/study/session/:sessionId`：展示会话题目、首个单词卡片和下一步提示。
- 更新移动端 E2E：游客登录、选词库、生成计划、进入今日任务、创建并打开首个学习会话。

## 非目标

- 不提交作答，不创建 `ReviewLog`。
- 不更新 SRS 进度和错词状态。
- 不实现学习结果页、打卡和离线同步。
- 不接入真实音频播放；只展示音标和“音频暂未接入”状态。

## TDD 任务

### Task 1: Domain 今日任务排序

- [ ] 写 `packages/domain/src/today/tasks.test.ts`，覆盖复习任务排在新词前、每日上限、无 active plan 空任务。
- [ ] 实现 `packages/domain/src/today/tasks.ts` 并从 `packages/domain/src/index.ts` 导出。
- [ ] 运行 `pnpm --filter @wordscodex/domain exec vitest run src/today/tasks.test.ts`。

### Task 2: Contracts

- [ ] 写 `packages/contracts/src/study-session.test.ts`，覆盖 word/session/today/create request schema。
- [ ] 实现 `packages/contracts/src/study-session.ts` 并从 `packages/contracts/src/index.ts` 导出。
- [ ] 扩展错误码 `NO_ACTIVE_STUDY_PLAN`、`EMPTY_STUDY_SESSION`。
- [ ] 运行 `pnpm --filter @wordscodex/contracts exec vitest run src/study-session.test.ts src/auth.test.ts`。

### Task 3: API 和数据模型

- [ ] 更新 Prisma schema 和迁移：`VocabularyWord`、`UserWordProgress`、`StudySession`、`StudySessionItem`。
- [ ] 更新 seed，为 `cet4-core` 写入一组可测试样例词。
- [ ] 写 `apps/api/src/modules/study-sessions/study-session-routes.test.ts`，覆盖今日任务、创建新词会话、读取自己的会话、拒绝未登录和拒绝访问他人会话。
- [ ] 实现 repository 与 routes，并在 `apps/api/src/app.ts` 注册。
- [ ] 运行 API focused tests。

### Task 4: Web 今日任务和会话页

- [ ] 写 `HomePage.test.tsx`，覆盖加载、无计划、任务展示、创建会话后跳转、API 错误。
- [ ] 写 `StudySessionPage.test.tsx`，覆盖加载会话、展示首个单词、错误返回首页。
- [ ] 实现 `apps/web/src/features/study/api.ts`、`HomePage.tsx`、`StudySessionPage.tsx` 和路由。
- [ ] 补充移动端样式，保持现有绿色卡片视觉。
- [ ] 运行 Web focused tests。

### Task 5: E2E 与文档

- [ ] 更新 Playwright 词库路径，生成计划后点击“开始今日学习”并看到学习会话。
- [ ] 更新 `docs/DEVELOPMENT.md`，记录本步已落地的会话骨架边界。
- [ ] 运行 format、lint、typecheck、test、build、db:deploy、db:seed、test:e2e 和 375px Browser 检查。

## 验收

- 新用户能从登录连续完成：选择词库 → 生成计划 → 查看今日任务 → 创建并打开新词学习会话。
- 会话题目顺序由服务端固化，刷新可通过 `GET /study-sessions/:sessionId` 读取。
- 没有 active plan 时 `/home` 不展示假任务，而是引导去选词库。
- 所有新增数据和 API 响应都通过 contracts 校验。
- 本步不声称已经完成主动回忆、ReviewLog 或 SRS 写入。
