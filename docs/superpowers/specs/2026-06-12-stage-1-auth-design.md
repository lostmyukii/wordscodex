# Stage 1 账户与鉴权设计

## 目标

为 Wordscodex 建立可扩展的 MVP 账户入口：

- 用户可以使用邮箱验证码登录或注册；
- 用户可以创建访客账号并进入新手引导；
- 登录状态支持刷新、注销和读取当前用户；
- 访客后续可以绑定邮箱升级为正式账号；
- API、Web 和数据库使用同一组共享契约。

本规格只覆盖账户与鉴权，不提前实现词库、新手引导表单或学习计划。

## 方案选择

### 采用方案：邮箱验证码 + 服务端刷新会话

访问令牌使用短期 JWT，刷新令牌使用随机不透明值并通过 HttpOnly Cookie
传递。服务端只保存刷新令牌的 SHA-256 哈希，因此可以轮换、注销和撤销会话。
验证码使用独立存储和发送接口，业务代码不依赖具体邮件供应商。

### 未采用方案

1. **完全无状态 JWT：** 实现更少，但刷新令牌泄漏后难以及时撤销，不满足注销和
   会话治理需求。
2. **邮箱魔法链接：** 安全性良好，但移动端跨应用跳转更复杂，也不符合当前文档规定的
   验证码交互。

## 用户与会话模型

### User

```ts
type User = {
  id: string
  email: string | null
  displayName: string
  role: 'learner' | 'admin'
  accountType: 'guest' | 'registered'
  timezone: string
  createdAt: string
  updatedAt: string
}
```

- `email` 标准化为小写并去除首尾空格，正式用户必须唯一；
- 访客用户的 `email` 为 `null`；
- 默认角色为 `learner`；
- 默认时区由客户端提交，未提交时使用 `Asia/Shanghai`；
- 访客绑定邮箱后更新同一条 User，不迁移学习数据。

### AuthSession

```ts
type AuthSession = {
  id: string
  userId: string
  refreshTokenHash: string
  expiresAt: string
  revokedAt: string | null
  createdAt: string
  updatedAt: string
}
```

- 每次刷新都轮换刷新令牌并更新哈希；
- 使用旧刷新令牌再次刷新时返回未授权；
- 注销只撤销当前会话，不影响用户的其他设备；
- 过期或撤销的会话不能刷新。

验证码不写入 PostgreSQL。它由 `VerificationCodeStore` 保存，生产实现使用 Redis，
测试使用内存实现。记录包含邮箱、验证码哈希、过期时间、错误尝试次数和是否已消费。

## API 契约

### `POST /api/v1/auth/request-code`

请求：

```json
{
  "email": "learner@example.com"
}
```

成功始终返回 `202`：

```json
{
  "accepted": true,
  "expiresInSeconds": 600
}
```

接口不暴露邮箱是否已注册。验证码为 6 位数字，10 分钟过期；同一邮箱 60 秒内不能
重复发送，并按 IP 与邮箱限流。

本地开发和自动化测试使用 `AUTH_DEV_CODE` 固定验证码。该配置只允许在
`development` 和 `test` 环境启用，响应和日志都不返回验证码。

### `POST /api/v1/auth/verify-code`

请求：

```json
{
  "email": "learner@example.com",
  "code": "123456",
  "timezone": "Asia/Shanghai"
}
```

验证码正确时创建或读取正式用户、创建刷新会话，并返回：

```json
{
  "accessToken": "short-lived-jwt",
  "expiresInSeconds": 900,
  "user": {
    "id": "user_123",
    "email": "learner@example.com",
    "displayName": "学习者",
    "role": "learner",
    "accountType": "registered",
    "timezone": "Asia/Shanghai",
    "createdAt": "2026-06-12T00:00:00.000Z",
    "updatedAt": "2026-06-12T00:00:00.000Z"
  }
}
```

刷新令牌放入 `HttpOnly`、`SameSite=Lax` Cookie；生产环境增加 `Secure`。验证码最多
允许 5 次错误尝试，成功后立即消费。

如果请求同时携带有效的访客 Bearer 令牌，接口把当前访客 User 升级为正式用户，并保留
同一个 User ID。若邮箱已属于另一个正式用户，则返回 `ACCOUNT_EMAIL_IN_USE`，不自动
合并两个账号的数据。

### `POST /api/v1/auth/guest`

请求可包含时区：

```json
{
  "timezone": "Asia/Shanghai"
}
```

接口创建访客 User 和刷新会话，返回与验证码登录相同的会话结构。

### `POST /api/v1/auth/refresh`

读取刷新 Cookie，验证会话并轮换刷新令牌，返回新的访问令牌和当前用户。

### `POST /api/v1/auth/logout`

撤销当前刷新会话并清除 Cookie。无 Cookie 或会话已经撤销时仍返回 `204`，保持幂等。

### `GET /api/v1/me`

要求 Bearer 访问令牌，返回当前用户。令牌缺失、过期或签名无效时返回统一的
`UNAUTHORIZED` 错误。

## 错误结构

所有失败响应遵循现有开发文档：

```json
{
  "error": {
    "code": "AUTH_CODE_INVALID",
    "message": "验证码无效或已过期，请重新获取。",
    "requestId": "req_123"
  }
}
```

本阶段使用以下稳定错误代码：

- `VALIDATION_FAILED`
- `AUTH_CODE_RATE_LIMITED`
- `AUTH_CODE_INVALID`
- `AUTH_CODE_ATTEMPTS_EXCEEDED`
- `ACCOUNT_EMAIL_IN_USE`
- `UNAUTHORIZED`

错误信息不得包含验证码、完整邮箱、令牌、数据库错误或内部路径。

## 服务端结构

```text
apps/api/src/modules/auth/
├── auth.routes.ts
├── auth.service.ts
├── auth.repository.ts
├── code-store.ts
├── token-service.ts
└── auth.test.ts
```

- routes 只负责 HTTP、Cookie 和共享 Schema 校验；
- service 编排验证码、用户和会话流程；
- repository 封装 Prisma User/AuthSession 数据访问；
- code store 隔离 Redis 与测试内存实现；
- token service 负责随机刷新令牌、哈希和访问 JWT；
- `buildApp` 通过依赖注入允许 API 测试使用内存 code store 和测试 repository。

## Web 结构与交互

```text
apps/web/src/features/auth/
├── api.ts
├── auth-store.ts
├── LoginPage.tsx
└── LoginPage.test.tsx
```

- `/` 的“开始学习”进入 `/login`；
- 登录页第一步填写邮箱并请求验证码；
- 第二步输入 6 位验证码，成功后进入 `/onboarding`；
- “先体验一下”创建访客账号并进入 `/onboarding`；
- 访问令牌仅保存在 Zustand 内存状态，不写 `localStorage`；
- 刷新页面时通过刷新 Cookie 获取新访问令牌；
- 提交期间禁用按钮，并提供校验、限流、网络失败与重试提示；
- 375px 视口下输入框和提交按钮始终可见，点击区域不小于 44px。

本阶段只创建 `/onboarding` 的受保护占位页面，用于证明登录守卫与跳转有效；不实现
引导业务表单，也不增加其他空壳导航入口。

## 安全边界

- 访问令牌默认 15 分钟过期，刷新会话默认 30 天过期；
- JWT 密钥必须通过环境变量提供，生产环境不接受示例密钥；
- 刷新令牌不进入 JSON、日志或浏览器持久存储；
- 请求验证码、验证验证码和访客创建都必须限流；
- API 日志只允许记录请求 ID、结果代码和耗时；
- 跨域仅允许 `WEB_ORIGIN`，同时允许凭据 Cookie；
- 邮箱发送供应商不在本阶段接入，但接口边界必须可替换。

## 测试与验收

### Contracts

- 接受合法邮箱、验证码和用户响应；
- 拒绝非法邮箱、非 6 位验证码和未知角色；
- 标准错误结构保持稳定。

### API

- 请求验证码不泄露账号是否存在；
- 正确验证码创建正式用户和刷新会话；
- 已登录访客验证未占用邮箱后升级同一个 User；
- 访客绑定已占用邮箱时不合并账号并返回稳定错误；
- 错误/过期验证码被拒绝，错误次数达到上限后锁定；
- 访客入口创建 `guest` 用户；
- 刷新令牌只可使用一次并成功轮换；
- 注销后刷新失败；
- `/me` 拒绝缺失或无效访问令牌；
- 响应符合共享 contracts。

### Web

- 邮箱提交后显示验证码步骤；
- 表单错误与输入框关联；
- 验证成功和访客成功都跳转 `/onboarding`；
- API 错误显示中文消息并允许重试；
- Playwright 在移动端完成邮箱验证码登录和访客登录。

### 完成标准

- Prisma 迁移和 seed 在本地 PostgreSQL 成功；
- Redis code store 有集成测试，内存实现用于单元测试；
- format、lint、typecheck、test、build、e2e 全部通过；
- README 和 `.env.example` 包含 Redis、JWT 与本地验证码配置；
- `docs/DEVELOPMENT.md` 同步新增访客端点与最终字段。
