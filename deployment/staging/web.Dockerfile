FROM node:24-alpine AS build

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/domain/package.json packages/domain/package.json

RUN pnpm install --frozen-lockfile

COPY . .

ARG VITE_API_ORIGIN
ENV VITE_API_ORIGIN=${VITE_API_ORIGIN}

RUN pnpm --filter @wordscodex/web build

FROM nginx:1.27-alpine

COPY deployment/staging/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
