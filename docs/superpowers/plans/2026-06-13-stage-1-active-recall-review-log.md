# Stage 1 主动回忆与 ReviewLog 幂等提交

## 目标

在现有“今日任务 + 学习会话骨架”基础上，完成一个可持久化的主动回忆纵向切片：

- 前端学习页必须产生有效作答，而不是只展示单词卡；
- 作答提交必须携带 `Idempotency-Key`；
- 服务端必须写入只追加的 `ReviewLog`；
- 同一个事务内更新 `UserWordProgress`；
- 重复幂等键不能重复累计学习次数；
- 客户端展示服务端返回的调度结果。

## 范围

1. `packages/domain`
   - 新增 SRS v1 纯函数；
   - 覆盖四种回答等级、`easeFactor` 上下界、状态转换。
2. `packages/contracts`
   - 新增 ReviewRating、提交作答请求、调度结果和响应 Schema。
3. `apps/api`
   - 新增 `ReviewLog` Prisma 模型和迁移；
   - 新增 `POST /api/v1/study-sessions/:sessionId/reviews`；
   - 校验 `Idempotency-Key`、会话归属和题目归属；
   - 重复请求返回已处理结果且不重复写日志。
4. `apps/web`
   - 学习页改为主动回忆题；
   - 提交“不认识 / 有点模糊 / 认识”三种基础回答；
   - 显示作答已记录、下次复习时间和重复提交保护。
5. E2E
   - 移动端首次学习路径延伸到作答提交成功。

## 非目标

- 不在本步完成完整结果页；
- 不在本步完成错词本页面；
- 不在本步完成离线队列；
- 不引入完整 FSRS 或 AI 评测。

## 验收

- contracts、domain、api、web 单元测试覆盖新增行为；
- 数据库迁移可部署；
- E2E 可从登录、选词库、建计划、开始学习一路提交作答；
- 浏览器 375px 视口可操作学习提交；
- lint、typecheck、test、build 通过。

