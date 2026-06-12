# Stage 0 Engineering Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可安装、可开发、可测试、可构建的 pnpm workspace，交付 React PWA 应用壳、Fastify API 健康检查、共享 contracts/domain 包和 PostgreSQL 首个迁移。

**Architecture:** 使用模块化单体仓库：`apps/web` 承载 React Web/PWA，`apps/api` 承载 Fastify REST API，`packages/contracts` 提供跨端 Zod 契约，`packages/domain` 提供无框架依赖的领域逻辑。阶段 0 只建立工程边界和可运行链路，不实现登录、词库或学习业务。

**Tech Stack:** pnpm 11、React 19、TypeScript 6、Vite 8、Fastify 5、Zod 4、Prisma 7、PostgreSQL 16、Vitest 4、Testing Library、Playwright、ESLint 10、Prettier 3

---

## File Map

```text
.
├── .env.example
├── .github/workflows/ci.yml
├── .gitignore
├── .prettierignore
├── .prettierrc.json
├── README.md
├── eslint.config.mjs
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── apps/
│   ├── api/
│   │   ├── package.json
│   │   ├── prisma.config.ts
│   │   ├── prisma/schema.prisma
│   │   ├── src/app.ts
│   │   ├── src/env.ts
│   │   ├── src/index.ts
│   │   ├── src/routes/health.ts
│   │   ├── src/routes/health.test.ts
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   └── web/
│       ├── index.html
│       ├── package.json
│       ├── public/icons/icon.svg
│       ├── src/app/App.tsx
│       ├── src/app/App.test.tsx
│       ├── src/app/providers.tsx
│       ├── src/main.tsx
│       ├── src/styles/index.css
│       ├── src/test/setup.ts
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── vitest.config.ts
└── packages/
    ├── contracts/
    │   ├── package.json
    │   ├── src/health.ts
    │   ├── src/health.test.ts
    │   ├── src/index.ts
    │   ├── tsconfig.json
    │   └── vitest.config.ts
    ├── domain/
    │   ├── package.json
    │   ├── src/index.ts
    │   ├── src/system/readiness.ts
    │   ├── src/system/readiness.test.ts
    │   ├── tsconfig.json
    │   └── vitest.config.ts
    └── config/
        ├── package.json
        └── README.md
```

## Task 1: Bootstrap The Workspace

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Create: `eslint.config.mjs`
- Modify: `.gitignore`
- Create: `apps/web/package.json`
- Create: `apps/api/package.json`
- Create: `packages/contracts/package.json`
- Create: `packages/domain/package.json`
- Create: `packages/config/package.json`

- [x] **Step 1: Activate the pinned package manager**

Run:

```bash
corepack prepare pnpm@11.6.0 --activate
pnpm --version
```

Expected: `11.6.0`.

- [x] **Step 2: Create the root workspace configuration**

Create `package.json`:

```json
{
  "name": "wordscodex",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@11.6.0",
  "engines": {
    "node": ">=24.0.0"
  },
  "scripts": {
    "dev": "pnpm --parallel --filter @wordscodex/web --filter @wordscodex/api dev",
    "dev:web": "pnpm --filter @wordscodex/web dev",
    "dev:api": "pnpm --filter @wordscodex/api dev",
    "lint": "eslint .",
    "typecheck": "pnpm -r typecheck",
    "test": "pnpm -r test",
    "test:e2e": "pnpm --filter @wordscodex/web test:e2e",
    "build": "pnpm -r build",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "db:generate": "pnpm --filter @wordscodex/api db:generate",
    "db:migrate": "pnpm --filter @wordscodex/api db:migrate",
    "db:seed": "pnpm --filter @wordscodex/api db:seed"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "eslint": "10.4.1",
    "eslint-config-prettier": "10.1.8",
    "globals": "17.6.0",
    "prettier": "3.8.4",
    "typescript": "6.0.3",
    "typescript-eslint": "8.61.0"
  }
}
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

- [x] **Step 3: Create formatting and lint configuration**

Create `.prettierrc.json`:

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all"
}
```

Create `.prettierignore`:

```text
dist
coverage
node_modules
playwright-report
test-results
pnpm-lock.yaml
docs
AGENTS.md
融合版_智能词汇学习产品需求分析.md
```

Create `eslint.config.mjs`:

```js
import eslint from '@eslint/js'
import { defineConfig } from 'eslint/config'
import prettier from 'eslint-config-prettier'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [eslint.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  prettier,
)
```

Append to `.gitignore`:

```text
.env
.env.*
!.env.example
node_modules/
dist/
coverage/
playwright-report/
test-results/
apps/api/generated/
```

- [x] **Step 4: Create package manifests**

Create `packages/contracts/package.json`:

```json
{
  "name": "@wordscodex/contracts",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc --noEmit",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "4.4.3"
  },
  "devDependencies": {
    "vitest": "4.1.8"
  }
}
```

Create `packages/domain/package.json` with the same scripts and no runtime dependencies:

```json
{
  "name": "@wordscodex/domain",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc --noEmit",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "4.1.8"
  }
}
```

Create `packages/config/package.json`:

```json
{
  "name": "@wordscodex/config",
  "version": "0.1.0",
  "private": true,
  "type": "module"
}
```

Create `packages/config/README.md`:

```markdown
# @wordscodex/config

共享工程配置的归属包。阶段 0 先由根目录提供 TypeScript、ESLint 和 Prettier 基线；
当 Web 与 API 出现不同配置需求时，再把稳定的公共配置移入本包。
```

Create `apps/api/package.json`:

```json
{
  "name": "@wordscodex/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc --noEmit",
    "start": "tsx src/index.ts",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@fastify/cors": "11.2.0",
    "@prisma/adapter-pg": "7.8.0",
    "@prisma/client": "7.8.0",
    "@wordscodex/contracts": "workspace:*",
    "dotenv": "17.4.2",
    "fastify": "5.8.5",
    "pg": "8.21.0",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@types/node": "24.13.2",
    "@types/pg": "8.20.0",
    "prisma": "7.8.0",
    "tsx": "4.22.4",
    "vitest": "4.1.8"
  }
}
```

Create `apps/web/package.json`:

```json
{
  "name": "@wordscodex/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@tanstack/react-query": "5.101.0",
    "@wordscodex/contracts": "workspace:*",
    "dexie": "4.4.3",
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "react-hook-form": "7.78.0",
    "react-router-dom": "7.17.0",
    "zod": "4.4.3",
    "zustand": "5.0.14"
  },
  "devDependencies": {
    "@playwright/test": "1.60.0",
    "@testing-library/jest-dom": "6.9.1",
    "@testing-library/react": "16.3.2",
    "@types/react": "19.2.17",
    "@types/react-dom": "19.2.3",
    "@tailwindcss/vite": "4.3.0",
    "@vitejs/plugin-react": "6.0.2",
    "jsdom": "29.0.1",
    "tailwindcss": "4.3.0",
    "vite": "8.0.16",
    "vite-plugin-pwa": "1.3.0",
    "vitest": "4.1.8"
  }
}
```

- [x] **Step 5: Install and verify workspace resolution**

Run:

```bash
pnpm install
pnpm list -r --depth 0
```

Expected: five workspace packages resolve without peer dependency errors.

- [x] **Step 6: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json \
  .prettierrc.json .prettierignore eslint.config.mjs .gitignore \
  apps packages
git commit -m "build: bootstrap pnpm workspace"
```

## Task 2: Establish Shared Contracts And Domain Boundaries

**Files:**
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/vitest.config.ts`
- Create: `packages/contracts/src/health.test.ts`
- Create: `packages/contracts/src/health.ts`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/domain/tsconfig.json`
- Create: `packages/domain/vitest.config.ts`
- Create: `packages/domain/src/system/readiness.test.ts`
- Create: `packages/domain/src/system/readiness.ts`
- Create: `packages/domain/src/index.ts`

- [x] **Step 1: Create package TypeScript and Vitest configuration**

Create `packages/contracts/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["vitest/globals"],
    "noEmit": true
  },
  "include": ["src", "vitest.config.ts"]
}
```

Create `packages/contracts/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

Create `packages/domain/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["vitest/globals"],
    "noEmit": true
  },
  "include": ["src", "vitest.config.ts"]
}
```

Create `packages/domain/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

- [x] **Step 2: Write failing health contract tests**

Create `packages/contracts/src/health.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { healthResponseSchema } from './health.js'

describe('healthResponseSchema', () => {
  it('accepts the public API health payload', () => {
    const result = healthResponseSchema.parse({
      status: 'ok',
      service: 'wordscodex-api',
    })

    expect(result.status).toBe('ok')
  })

  it('rejects unknown health states', () => {
    expect(() =>
      healthResponseSchema.parse({
        status: 'degraded',
        service: 'wordscodex-api',
      }),
    ).toThrow()
  })
})
```

- [x] **Step 3: Run the contract test and verify RED**

Run:

```bash
pnpm --filter @wordscodex/contracts test
```

Expected: FAIL because `./health.js` does not exist.

- [x] **Step 4: Implement the health contract**

Create `packages/contracts/src/health.ts`:

```ts
import { z } from 'zod'

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('wordscodex-api'),
})

export type HealthResponse = z.infer<typeof healthResponseSchema>
```

Create `packages/contracts/src/index.ts`:

```ts
export {
  healthResponseSchema,
  type HealthResponse,
} from './health.js'
```

- [x] **Step 5: Run the contract test and verify GREEN**

Run:

```bash
pnpm --filter @wordscodex/contracts test
```

Expected: 2 tests pass.

- [x] **Step 6: Write the failing readiness domain test**

Create `packages/domain/src/system/readiness.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getSystemReadiness } from './readiness.js'

describe('getSystemReadiness', () => {
  it('reports ready when every dependency is reachable', () => {
    expect(
      getSystemReadiness({
        database: true,
        cache: true,
      }),
    ).toEqual({
      ready: true,
      unavailable: [],
    })
  })

  it('lists unavailable dependencies', () => {
    expect(
      getSystemReadiness({
        database: false,
        cache: true,
      }),
    ).toEqual({
      ready: false,
      unavailable: ['database'],
    })
  })
})
```

- [x] **Step 7: Run the domain test and verify RED**

Run:

```bash
pnpm --filter @wordscodex/domain test
```

Expected: FAIL because `./readiness.js` does not exist.

- [x] **Step 8: Implement readiness calculation**

Create `packages/domain/src/system/readiness.ts`:

```ts
type Dependencies = {
  database: boolean
  cache: boolean
}

type Readiness = {
  ready: boolean
  unavailable: Array<keyof Dependencies>
}

export function getSystemReadiness(
  dependencies: Dependencies,
): Readiness {
  const unavailable = (
    Object.entries(dependencies) as Array<
      [keyof Dependencies, boolean]
    >
  )
    .filter(([, available]) => !available)
    .map(([name]) => name)

  return {
    ready: unavailable.length === 0,
    unavailable,
  }
}
```

Create `packages/domain/src/index.ts`:

```ts
export { getSystemReadiness } from './system/readiness.js'
```

- [x] **Step 9: Run package tests and commit**

Run:

```bash
pnpm --filter @wordscodex/contracts test
pnpm --filter @wordscodex/domain test
```

Expected: 4 tests pass.

Commit:

```bash
git add packages/contracts packages/domain
git commit -m "test: establish shared package boundaries"
```

## Task 3: Create The Fastify API And PostgreSQL Baseline

**Files:**
- Create: `.env.example`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/src/env.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/src/routes/health.test.ts`
- Create: `apps/api/src/routes/health.ts`
- Create: `apps/api/prisma.config.ts`
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/seed.ts`
- Create: `apps/api/prisma/migrations/*/migration.sql`

- [ ] **Step 1: Create API TypeScript and test configuration**

Create `apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["node", "vitest/globals"],
    "noEmit": true
  },
  "include": ["src", "prisma", "prisma.config.ts", "vitest.config.ts"]
}
```

Create `apps/api/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 2: Write the failing health endpoint test**

Create `apps/api/src/routes/health.test.ts`:

```ts
import { healthResponseSchema } from '@wordscodex/contracts'
import { afterEach, describe, expect, it } from 'vitest'
import { buildApp } from '../app.js'

describe('GET /api/v1/health', () => {
  const app = buildApp()

  afterEach(async () => {
    await app.close()
  })

  it('returns a contract-valid health response', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    })

    expect(response.statusCode).toBe(200)
    expect(healthResponseSchema.parse(response.json())).toEqual({
      status: 'ok',
      service: 'wordscodex-api',
    })
  })
})
```

- [ ] **Step 3: Run the API test and verify RED**

Run:

```bash
pnpm --filter @wordscodex/api test
```

Expected: FAIL because `src/app.ts` does not exist.

- [ ] **Step 4: Implement the API application factory and route**

Create `apps/api/src/routes/health.ts`:

```ts
import type { FastifyPluginAsync } from 'fastify'
import type { HealthResponse } from '@wordscodex/contracts'

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get<{ Reply: HealthResponse }>('/health', async () => ({
    status: 'ok',
    service: 'wordscodex-api',
  }))
}
```

Create `apps/api/src/app.ts`:

```ts
import cors from '@fastify/cors'
import Fastify from 'fastify'
import { healthRoutes } from './routes/health.js'

export function buildApp() {
  const app = Fastify({
    logger: false,
  })

  void app.register(cors, {
    origin: true,
    credentials: true,
  })
  void app.register(healthRoutes, {
    prefix: '/api/v1',
  })

  return app
}
```

Create `apps/api/src/env.ts`:

```ts
import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
})

export const env = envSchema.parse(process.env)
```

Create `apps/api/src/index.ts`:

```ts
import { buildApp } from './app.js'
import { env } from './env.js'

const app = buildApp()

await app.listen({
  host: env.API_HOST,
  port: env.API_PORT,
})
```

- [ ] **Step 5: Run the API test and verify GREEN**

Run:

```bash
pnpm --filter @wordscodex/api test
```

Expected: 1 test passes.

- [ ] **Step 6: Configure Prisma and PostgreSQL**

Create `.env.example`:

```text
DATABASE_URL=postgresql://localhost:5432/wordscodex
API_HOST=127.0.0.1
API_PORT=3001
WEB_ORIGIN=http://localhost:5173
VITE_API_ORIGIN=http://localhost:3001
```

Create `apps/api/prisma.config.ts`:

```ts
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})
```

Create `apps/api/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
}

model SystemMetadata {
  key       String   @id
  value     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

Create `apps/api/prisma/seed.ts`:

```ts
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'
import { PrismaClient } from '../generated/prisma/client.js'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('DATABASE_URL is required')
}

const adapter = new PrismaPg({
  connectionString,
})
const prisma = new PrismaClient({ adapter })

await prisma.systemMetadata.upsert({
  where: { key: 'schema_version' },
  update: { value: 'stage-0' },
  create: {
    key: 'schema_version',
    value: 'stage-0',
  },
})

await prisma.$disconnect()
```

- [ ] **Step 7: Create the local database and first migration**

Run:

```bash
createdb wordscodex 2>/dev/null || true
cp .env.example apps/api/.env
pnpm db:generate
pnpm db:migrate -- --name init_system_metadata
pnpm db:seed
psql wordscodex -c 'select key, value from "SystemMetadata";'
```

Expected: one row with `schema_version | stage-0`.

- [ ] **Step 8: Commit**

```bash
git add .env.example apps/api
git commit -m "feat: add API and database baseline"
```

## Task 4: Create The React PWA Application Shell

**Files:**
- Create: `apps/web/index.html`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/e2e/app-shell.spec.ts`
- Create: `apps/web/src/test/setup.ts`
- Create: `apps/web/src/app/App.test.tsx`
- Create: `apps/web/src/app/App.tsx`
- Create: `apps/web/src/app/providers.tsx`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/styles/index.css`
- Create: `apps/web/public/icons/icon.svg`

- [ ] **Step 1: Create Web TypeScript and test configuration**

Create `apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts"]
}
```

Create `apps/web/vitest.config.ts`:

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
```

Create `apps/web/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 2: Write the failing component and browser tests**

Create `apps/web/src/app/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('presents the stage zero product entry', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', {
        name: '把单词真正记住',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: '开始学习',
      }),
    ).toHaveAttribute('href', '/onboarding')
  })
})
```

Create `apps/web/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://127.0.0.1:4173',
  },
  webServer: {
    command: 'pnpm build && pnpm preview --host 127.0.0.1',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
})
```

Create `apps/web/e2e/app-shell.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('shows a usable mobile product entry', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', {
      name: '把单词真正记住',
    }),
  ).toBeVisible()

  const action = page.getByRole('link', {
    name: '开始学习',
  })

  await expect(action).toBeVisible()
  await expect(action).toHaveAttribute('href', '/onboarding')
})
```

- [ ] **Step 3: Run the Web test and verify RED**

Run:

```bash
pnpm --filter @wordscodex/web test
pnpm exec playwright install chromium
pnpm --filter @wordscodex/web test:e2e
```

Expected: both commands FAIL because `src/app/App.tsx` does not exist.

- [ ] **Step 4: Implement the minimal application shell**

Create `apps/web/src/app/App.tsx`:

```tsx
export function App() {
  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">科学记忆 · 主动回忆 · 智能复习</p>
        <h1 id="hero-title">把单词真正记住</h1>
        <p className="hero-copy">
          用清晰的每日任务，把学习、回忆和复习连成一条完整路径。
        </p>
        <a className="primary-action" href="/onboarding">
          开始学习
        </a>
      </section>
    </main>
  )
}
```

Create `apps/web/src/app/providers.tsx`:

```tsx
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'

const queryClient = new QueryClient()

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
```

Create `apps/web/src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { AppProviders } from './app/providers'
import './styles/index.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Root element was not found')
}

createRoot(root).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
)
```

Create `apps/web/src/styles/index.css`:

```css
@import "tailwindcss";

:root {
  color: #172032;
  background: #f6f8f3;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    "Segoe UI", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

.app-shell {
  display: grid;
  min-height: 100vh;
  place-items: center;
  padding: 24px;
}

.hero {
  width: min(100%, 720px);
  padding: clamp(32px, 8vw, 72px);
  border: 1px solid #dce3d4;
  border-radius: 32px;
  background: #ffffff;
  box-shadow: 0 24px 80px rgb(46 68 37 / 10%);
}

.eyebrow {
  margin: 0 0 16px;
  color: #52743d;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

h1 {
  margin: 0;
  font-size: clamp(42px, 10vw, 76px);
  line-height: 0.98;
}

.hero-copy {
  max-width: 34rem;
  margin: 24px 0 32px;
  color: #586174;
  font-size: 18px;
  line-height: 1.7;
}

.primary-action {
  display: inline-flex;
  min-height: 48px;
  align-items: center;
  justify-content: center;
  padding: 0 24px;
  border-radius: 999px;
  color: #ffffff;
  background: #335e2b;
  font-weight: 700;
  text-decoration: none;
}

.primary-action:focus-visible {
  outline: 3px solid #f0bd45;
  outline-offset: 4px;
}
```

- [ ] **Step 5: Configure Vite and PWA**

Create `apps/web/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0"
    />
    <meta
      name="description"
      content="以主动回忆和科学复习为核心的智能词汇学习平台"
    />
    <title>Wordscodex 智能词汇学习</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `apps/web/vite.config.ts`:

```ts
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Wordscodex 智能词汇学习',
        short_name: 'Wordscodex',
        description: '以主动回忆和科学复习为核心的词汇学习平台',
        theme_color: '#335e2b',
        background_color: '#f6f8f3',
        display: 'standalone',
        lang: 'zh-CN',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
})
```

Create `apps/web/public/icons/icon.svg`:

```svg
<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 512 512"
  role="img"
  aria-label="Wordscodex"
>
  <rect width="512" height="512" rx="112" fill="#335e2b" />
  <path
    d="M132 132h86c37 0 66 13 86 38 20-25 49-38 86-38h-10v242h-70c-39 0-68 11-86 34-18-23-47-34-86-34h-6V132Z"
    fill="#f6f8f3"
  />
  <path
    d="M256 176v205"
    fill="none"
    stroke="#335e2b"
    stroke-width="18"
    stroke-linecap="round"
  />
</svg>
```

- [ ] **Step 6: Run the Web test and verify GREEN**

Run:

```bash
pnpm --filter @wordscodex/web test
pnpm --filter @wordscodex/web build
pnpm --filter @wordscodex/web test:e2e
```

Expected: one component test and one mobile Chromium test pass; Vite creates `apps/web/dist`.

- [ ] **Step 7: Commit**

```bash
git add apps/web
git commit -m "feat: add responsive PWA application shell"
```

## Task 5: Add Repository Verification And Developer Onboarding

**Files:**
- Create: `README.md`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create CI configuration**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/wordscodex
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11.6.0
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:generate
      - run: pnpm format:check
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test:e2e
```

- [ ] **Step 2: Create developer onboarding instructions**

Create `README.md` with:

````markdown
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
createdb wordscodex
cp .env.example apps/api/.env
pnpm db:generate
pnpm db:migrate -- --name init
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
````

- [ ] **Step 3: Run full verification**

Run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm dev:api > /tmp/wordscodex-api.log 2>&1 &
API_PID=$!
trap 'kill $API_PID' EXIT
sleep 2
curl --fail http://127.0.0.1:3001/api/v1/health
```

Expected:

- formatting check exits 0;
- ESLint exits 0;
- every package type-checks;
- all unit and component tests pass;
- all workspace packages build;
- mobile Chromium smoke test passes;
- health endpoint returns `{"status":"ok","service":"wordscodex-api"}`.

- [ ] **Step 4: Commit and push**

```bash
git add README.md .github
git commit -m "ci: verify stage zero baseline"
git push origin main
```

## Stage 0 Completion Gate

阶段 0 只有在以下证据齐备后才计为整体进度 15%：

- `pnpm install --frozen-lockfile` 可在全新检出中完成；
- Web 与 API 能同时启动；
- API 健康检查契约测试通过；
- PostgreSQL 首个迁移和 seed 成功；
- Web 应用壳在 375px 级别手机视口可使用；
- PWA manifest 和图标进入生产构建；
- format、lint、typecheck、test、build、e2e 全部通过；
- README 命令与实际脚本一致；
- 所有阶段 0 提交已推送到远端。
