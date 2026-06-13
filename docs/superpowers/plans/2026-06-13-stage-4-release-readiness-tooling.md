# Stage 4 Release Readiness Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first runnable Stage 4 release-readiness tooling: API security guardrails, vocabulary import validation, and a root release check command.

**Architecture:** Keep release checks as small TypeScript modules with tests so they can run locally and in CI. API runtime hardening stays inside `apps/api/src/app.ts` and `auth-routes.ts`; vocabulary validation lives under `scripts/import-vocabulary`; release orchestration lives under `scripts/release-readiness`.

**Tech Stack:** pnpm workspace, TypeScript, Fastify, Zod, Vitest, Node.js `tsx`, Prisma-compatible vocabulary CSV fields.

---

### Task 1: API Security Guardrails

**Files:**
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/modules/auth/auth-routes.ts`
- Modify: `apps/api/src/modules/auth/auth-routes.test.ts`
- Create: `apps/api/src/shared/security.ts`
- Create: `apps/api/src/shared/security.test.ts`

- [ ] **Step 1: Write failing security unit tests**
  - Test that logger redaction paths include headers authorization, cookies, verification code, refresh token, and email.
  - Test that production cookie options are `httpOnly`, `secure`, `sameSite: 'lax'`, and scoped to `/api/v1/auth`.

- [ ] **Step 2: Run tests and verify RED**
  - Run: `pnpm --filter @wordscodex/api test -- security.test.ts auth-routes.test.ts`
  - Expected: fail because shared security helpers do not exist.

- [ ] **Step 3: Implement shared security helpers**
  - Export `loggerRedactionPaths`.
  - Export `buildRefreshCookieOptions({ secure })`.
  - Export `authWriteRateLimit` values for refresh/logout/me safety.

- [ ] **Step 4: Wire app and auth routes**
  - Enable Fastify logger only outside test with redaction.
  - Use shared cookie helper.
  - Add rate limits to `/auth/refresh`, `/auth/logout`, and `/me`.

- [ ] **Step 5: Run tests and verify GREEN**
  - Run: `pnpm --filter @wordscodex/api test -- security.test.ts auth-routes.test.ts`
  - Expected: pass.

### Task 2: Vocabulary Import Validation CLI

**Files:**
- Create: `scripts/import-vocabulary/validator.ts`
- Create: `scripts/import-vocabulary/validator.test.ts`
- Create: `scripts/import-vocabulary/cli.ts`
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Write failing validator tests**
  - Valid CSV returns stats with `valid: true`.
  - Missing `lemma`, missing `part_of_speech`, missing `definition_zh`, duplicate lemma in a book, missing source for audio/example, and non-HTTPS asset URL return row-level errors.

- [ ] **Step 2: Run validator tests and verify RED**
  - Run: `pnpm exec vitest run scripts/import-vocabulary/validator.test.ts`
  - Expected: fail because validator module does not exist.

- [ ] **Step 3: Implement validator**
  - Parse CSV with quoted fields.
  - Validate fields required by `docs/DEVELOPMENT.md`.
  - Return stats: `totalRows`, `validRows`, `invalidRows`, `newCount`, `updateCount`, `skippedCount`, `failedCount`.

- [ ] **Step 4: Add CLI**
  - `pnpm vocabulary:validate <file>` validates only.
  - `pnpm vocabulary:import <file>` runs validation and prints a dry-run import summary; it does not write production DB yet.

- [ ] **Step 5: Run validator tests and script smoke**
  - Run: `pnpm exec vitest run scripts/import-vocabulary/validator.test.ts`
  - Run: `pnpm vocabulary:validate scripts/import-vocabulary/fixtures/valid-vocabulary.csv`
  - Expected: both pass.

### Task 3: Release Readiness Check

**Files:**
- Create: `scripts/release-readiness/checklist.ts`
- Create: `scripts/release-readiness/checklist.test.ts`
- Create: `scripts/release-readiness/cli.ts`
- Modify: `package.json`
- Modify: `docs/DEVELOPMENT.md`

- [ ] **Step 1: Write failing checklist tests**
  - Stage 4 check fails when required scripts are missing.
  - Stage 4 check passes when scripts exist and required docs mention security, accessibility, content validation, and staging.

- [ ] **Step 2: Run checklist tests and verify RED**
  - Run: `pnpm exec vitest run scripts/release-readiness/checklist.test.ts`
  - Expected: fail because checklist module does not exist.

- [ ] **Step 3: Implement checklist and CLI**
  - Check root scripts: `lint`, `typecheck`, `test`, `test:e2e`, `build`, `db:deploy`, `db:seed`, `vocabulary:validate`, `vocabulary:import`.
  - Check docs contain Stage 4 release gates.
  - Print Chinese pass/fail output and exit non-zero on failure.

- [ ] **Step 4: Run checklist tests and command**
  - Run: `pnpm exec vitest run scripts/release-readiness/checklist.test.ts`
  - Run: `pnpm release:check`
  - Expected: both pass.

### Task 4: Full Verification

**Files:**
- Modify: `docs/DEVELOPMENT.md`
- Modify: `README.md`

- [ ] **Step 1: Document commands and Stage 4 first-version status**
  - Update DEVELOPMENT with security guardrails, vocabulary validation, and release check first version.
  - Update README command list with `vocabulary:*` and `release:check`.

- [ ] **Step 2: Run full verification**
  - Run: `pnpm format`
  - Run: `pnpm lint`
  - Run: `pnpm typecheck`
  - Run: `pnpm test`
  - Run: `pnpm build`
  - Run: `pnpm db:deploy`
  - Run: `pnpm test:e2e`
  - Run: `git diff --check`

- [ ] **Step 3: Mobile/browser smoke check**
  - Start preview and confirm homepage still renders at 390px with zero console errors.
