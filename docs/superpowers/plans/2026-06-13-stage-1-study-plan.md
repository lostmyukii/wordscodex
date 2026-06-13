# Stage 1 学习计划生成切片计划

## 目标

把“选择词库”继续推进到“生成第一个学习计划”，让新用户从登录、词库详情、新手引导到 active study plan 形成可持久化闭环。

## 范围

- `packages/domain` 增加学习计划目标日期计算纯函数。
- `packages/contracts` 定义学习目标、学习计划、创建请求、active plan 响应和冲突错误码。
- `apps/api` 增加 `StudyPlan` Prisma 模型、部分唯一索引和 `/api/v1/study-plans`、`/api/v1/study-plans/active`。
- `apps/web` 将 `/onboarding?book=<slug>` 改成完整表单，支持目标、每日新词量、可选目标日期、提醒偏好、提交、错误和已存在计划展示。
- Playwright 覆盖移动端访客从词库详情创建计划的路径。

## 非目标

- 不在本步骤生成今日任务、学习会话或 SRS 队列。
- 不实现提醒发送，只保存提醒偏好。
- 不实现多计划切换；MVP 仍保持每个用户最多一个 active plan。

## 验收

- Domain 测试覆盖目标日期计算和非法每日词量。
- Contracts 测试覆盖学习计划请求/响应和 active plan 冲突错误码。
- API 测试覆盖创建计划、自动估算目标日期、读取 active plan、未登录拒绝和重复 active plan 冲突。
- Web 测试覆盖预选词库、提交表单、API 错误、已存在计划状态。
- 移动端 E2E 覆盖访客创建第一个学习计划。
- `format:check`、`lint`、`typecheck`、`test`、`build`、`test:e2e` 通过。
