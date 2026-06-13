FROM node:24-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/domain/package.json packages/domain/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @wordscodex/api db:generate

EXPOSE 3001

CMD ["pnpm", "--filter", "@wordscodex/api", "start"]
