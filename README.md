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
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```
