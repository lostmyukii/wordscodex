# Wordscodex

React + TypeScript 响应式 Web/PWA 智能词汇学习平台。

## Requirements

- Node.js 24+
- pnpm 11.6.0
- PostgreSQL 16+
- Redis 7+

## Setup

```bash
corepack prepare pnpm@11.6.0 --activate
pnpm install
psql postgres -c \
  "CREATE ROLE wordscodex WITH LOGIN CREATEDB PASSWORD 'wordscodex';"
createdb --owner=wordscodex wordscodex
redis-server --save "" --appendonly no
cp .env.example apps/api/.env
pnpm db:generate
pnpm db:migrate --name init
pnpm db:seed
pnpm dev
```

Web: `http://localhost:5173`

Login: `http://localhost:5173/login`

API health: `http://localhost:3001/api/v1/health`

## Environment

Local development uses `.env.example` as the safe template:

```dotenv
NODE_ENV=development
DATABASE_URL=postgresql://wordscodex:wordscodex@localhost:5432/wordscodex
REDIS_URL=redis://127.0.0.1:6379
JWT_ACCESS_SECRET=replace-with-at-least-32-characters
AUTH_DEV_CODE=123456
API_HOST=127.0.0.1
API_PORT=3001
WEB_ORIGIN=http://localhost:5173
VITE_API_ORIGIN=http://localhost:3001
```

`AUTH_DEV_CODE=123456` makes local and test email verification deterministic. Production must omit `AUTH_DEV_CODE` and provide `JWT_ACCESS_SECRET` through deployment secrets, not source control.

## Verification

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:deploy
pnpm db:seed
pnpm vocabulary:validate scripts/import-vocabulary/fixtures/valid-vocabulary.csv
pnpm release:audit
pnpm release:check
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

`pnpm vocabulary:import <csv-file>` 目前会先执行同一套校验并输出 dry-run 统计，不会直接写入生产数据库。上线前请先使用 `vocabulary:validate` 确认 lemma、词性、中文释义、资源 URL 和来源字段都符合要求。

Stage 4 发布准备包含两层本地门禁：`pnpm release:audit` 会检查 `apps/web/dist` 的首屏 JS gzip 预算、单 chunk gzip 预算、页面级 lazy chunk、PWA manifest、`focus-visible` 和 `prefers-reduced-motion`；`pnpm release:check` 会读取 `scripts/release-readiness/fixtures/stage4-acceptance.json`，确认性能预算、基础可访问性、备份恢复演练、staging 验收和合规入口门禁都已被记录。

## Staging Deployment

当前 staging 预览部署在独立公网端口：

- URL: `http://192.144.129.104:18080/`
- 部署目录：`/home/ubuntu/wordscodex-staging/current`
- Compose 文件：`deployment/staging/docker-compose.yml`
- 公网暴露：仅 `18080 -> web:80`
- 内部服务：`api:3001`、PostgreSQL、Redis 均只在 Docker 网络内访问

部署说明见 [`deployment/staging/README.md`](deployment/staging/README.md)。该 HTTP staging 端口用于验收和预览，不等同生产 HTTPS 发布。

## Launch Rehearsal

上线前在 staging 环境执行一次备份恢复演练：

```bash
pg_dump "$DATABASE_URL" --format=custom --file=tmp/wordscodex-staging.dump
createdb wordscodex_restore_drill
pg_restore --clean --if-exists --dbname=wordscodex_restore_drill tmp/wordscodex-staging.dump
pnpm db:deploy
pnpm db:seed
pnpm test:e2e
```

合规入口：

- 隐私政策：`/privacy`
- 用户协议：`/terms`
- 账号注销：`/account/delete`
