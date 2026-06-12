# Wordscodex

React + TypeScript 响应式 Web/PWA 智能词汇学习平台。

## Requirements

- Node.js 24+
- pnpm 11.6.0
- PostgreSQL 16+

## Setup

```bash
corepack prepare pnpm@11.6.0 --activate
pnpm install
psql postgres -c \
  "CREATE ROLE wordscodex WITH LOGIN CREATEDB PASSWORD 'wordscodex';"
createdb --owner=wordscodex wordscodex
cp .env.example apps/api/.env
pnpm db:generate
pnpm db:migrate --name init
pnpm db:seed
pnpm dev
```

Web: `http://localhost:5173`

API health: `http://localhost:3001/api/v1/health`

## Verification

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```
