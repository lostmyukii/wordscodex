# Stage 1 词库基础纵向切片计划

## 目标

在认证闭环之后，补齐 MVP 的“选择词库”入口，形成可运行、可测试、可持久化的词库列表与详情流程。

## 范围

- `packages/contracts` 定义词库分类、列表、详情和公共错误结构。
- `apps/api` 增加 `VocabularyBook` 持久化模型、种子数据和 `/api/v1/vocabulary-books` REST API。
- `apps/web` 增加受保护的 `/books` 与 `/books/:bookId` 页面，覆盖加载、空状态、错误、重试和移动端可点击区域。
- 引导页提供进入词库选择的明确下一步。

## 非目标

- 不在本步骤实现单词明细、学习计划、SRS 调度或离线同步。
- 不引入 mock 正式 API；示例词库必须来自数据库种子或测试替身。
- 不改变现有登录流程。

## 验收

- 合约测试覆盖词库响应和错误码稳定性。
- API 测试覆盖列表、搜索、详情和不存在词库的标准错误。
- Web 测试覆盖列表、详情、空状态、错误重试和引导入口。
- Prisma migration 与 generated client 同步。
- 相关 lint、typecheck、test、build 通过。
