# Stage 3 打卡与学习看板第一版实施计划

## 目标

把“完成学习会话后打卡”和“学习看板摘要”做成一条可运行、可测试、可持久化的纵向闭环。

## 范围

- 新增 `Checkin` 数据模型与迁移，保证同一用户同一天只能打卡一次。
- 新增连续打卡领域函数，并覆盖断签、重复日期和近 7 日视图。
- 新增 `checkins` 与 `dashboard` contracts。
- 新增 API：
  - `GET /api/v1/checkins`
  - `POST /api/v1/checkins`
  - `GET /api/v1/dashboard/summary`
  - `GET /api/v1/dashboard/trends?days=7`
- 新增 Web 页面：
  - `/checkin`
  - `/dashboard`
- 打通学习结果页、今日任务页到打卡和看板的入口。
- 扩展 E2E：完成首次学习后打卡，并在看板看到连续打卡与学习统计。

## 非目标

- 不做完整埋点平台。
- 不做 PWA 离线同步队列。
- 不做复杂日历月视图。
- 不做社交排行榜。

## 测试策略

- domain: 连续打卡计算单元测试。
- contracts: checkin/dashboard schema 单元测试。
- api: 鉴权、未完成会话禁止打卡、首次打卡、重复打卡幂等、看板摘要。
- web: 打卡页与看板页加载、错误、提交状态。
- e2e: 移动端首次学习闭环扩展至打卡与看板。

## 验收

- 完成学习会话后可进入 `/checkin` 打卡。
- 未完成学习会话直接打卡会返回稳定错误码。
- 重复打卡不会重复累计。
- `/dashboard` 展示今日会话、已学习、已掌握、连续打卡和近 7 日趋势。
- `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm test:e2e` 通过或明确报告阻塞。
