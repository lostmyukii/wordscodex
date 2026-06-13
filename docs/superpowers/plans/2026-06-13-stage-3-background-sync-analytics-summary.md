# Stage 3 Background Sync and Analytics Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the Stage 3 PWA/analytics backlog by adding progressive Background Sync registration, queued analytics batch flush, and a minimal authenticated analytics summary API.

**Architecture:** Keep the browser as the source of access tokens and use Background Sync as a progressive wake-up signal, not as a second auth system. The app registers sync tags when offline queues exist, flushes analytics in bounded batches on startup/online/background-sync messages, and exposes aggregate API metrics for admin/ops inspection without returning raw event payloads.

**Tech Stack:** React + TypeScript, vite-plugin-pwa, Workbox-generated service worker, Dexie IndexedDB queue, Fastify, Prisma, Zod contracts, Vitest, Testing Library.

---

### Task 1: Analytics Summary API

**Files:**
- Modify: `packages/contracts/src/analytics.ts`
- Modify: `packages/contracts/src/analytics.test.ts`
- Modify: `apps/api/src/modules/analytics/analytics-routes.ts`
- Modify: `apps/api/src/modules/analytics/analytics-routes.test.ts`
- Modify: `apps/api/src/modules/analytics/analytics-repository.ts`
- Modify: `docs/DEVELOPMENT.md`

- [ ] **Step 1: Write failing contract tests**
  - Add tests for `analyticsSummaryQuerySchema` defaults and max bounds.
  - Add tests for `analyticsSummaryResponseSchema` event rows and totals.

- [ ] **Step 2: Run contract tests and verify RED**
  - Run: `pnpm --filter @wordscodex/contracts test -- analytics.test.ts`
  - Expected: fail because summary schemas do not exist.

- [ ] **Step 3: Implement contracts**
  - Add query/response schemas and exported types.

- [ ] **Step 4: Run contract tests and verify GREEN**
  - Run: `pnpm --filter @wordscodex/contracts test -- analytics.test.ts`
  - Expected: pass.

- [ ] **Step 5: Write failing API tests**
  - Add authenticated `GET /api/v1/analytics/summary?days=7` test.
  - Add invalid bearer rejection test.

- [ ] **Step 6: Run API tests and verify RED**
  - Run: `pnpm --filter @wordscodex/api test -- analytics-routes.test.ts`
  - Expected: fail because the route/repository method does not exist.

- [ ] **Step 7: Implement API route and Prisma repository summary**
  - Require a valid bearer token.
  - Return totals and grouped event counts, not raw event properties.

- [ ] **Step 8: Run API tests and verify GREEN**
  - Run: `pnpm --filter @wordscodex/api test -- analytics-routes.test.ts`
  - Expected: pass.

### Task 2: Analytics Queue Batch Flush

**Files:**
- Modify: `apps/web/src/features/analytics/analytics-event-queue.ts`
- Modify: `apps/web/src/features/analytics/analytics-event-queue.test.ts`
- Create: `apps/web/src/features/analytics/flush-analytics-events.ts`
- Create: `apps/web/src/features/analytics/flush-analytics-events.test.ts`

- [ ] **Step 1: Write failing queue tests**
  - Add test that `markFailed` becomes ready after exponential backoff.
  - Add test that `listReady(limit)` returns the oldest events first.

- [ ] **Step 2: Run queue tests and verify RED/GREEN as appropriate**
  - Run: `pnpm --filter @wordscodex/web test -- analytics-event-queue.test.ts`

- [ ] **Step 3: Write failing flush tests**
  - Verify it sends ready events sequentially and deletes sent rows.
  - Verify it records retry metadata and stops after the first failure.

- [ ] **Step 4: Run flush tests and verify RED**
  - Run: `pnpm --filter @wordscodex/web test -- flush-analytics-events.test.ts`
  - Expected: fail because flush module does not exist.

- [ ] **Step 5: Implement flush helper**
  - Add `flushAnalyticsEventQueue` with `limit`, `client`, `queue`, and optional `accessToken`.

- [ ] **Step 6: Run analytics web tests and verify GREEN**
  - Run: `pnpm --filter @wordscodex/web test -- analytics-event-queue.test.ts flush-analytics-events.test.ts`
  - Expected: pass.

### Task 3: Background Sync Progressive Enhancement

**Files:**
- Create: `apps/web/src/app/background-sync.ts`
- Create: `apps/web/src/app/BackgroundSyncController.tsx`
- Create: `apps/web/src/app/BackgroundSyncController.test.tsx`
- Modify: `apps/web/src/app/providers.tsx`
- Modify: `apps/web/src/app/providers.test.tsx`
- Modify: `apps/web/src/features/study/StudySessionPage.tsx`
- Modify: `apps/web/src/features/study/StudySessionPage.test.tsx`
- Modify: `apps/web/src/features/analytics/track-event.ts`
- Modify: `apps/web/src/features/analytics/track-event.test.ts`
- Modify: `apps/web/e2e/vocabulary.spec.ts`
- Modify: `docs/DEVELOPMENT.md`

- [ ] **Step 1: Write failing background sync tests**
  - Verify supported browsers register analytics and review sync tags.
  - Verify unsupported browsers resolve with `unsupported`.
  - Verify controller flushes analytics and review queues on service-worker message.

- [ ] **Step 2: Run tests and verify RED**
  - Run: `pnpm --filter @wordscodex/web test -- BackgroundSyncController.test.tsx track-event.test.ts StudySessionPage.test.tsx`
  - Expected: fail because controller/helpers do not exist and tracking does not register sync.

- [ ] **Step 3: Implement background sync helpers and controller**
  - Register `wordscodex-analytics-flush` and `wordscodex-offline-review-sync`.
  - On `online`, queue change, analytics enqueue, and service-worker message, flush bounded work.
  - Never block learning submission on registration failures.

- [ ] **Step 4: Wire providers and queue creation points**
  - Add controller to `AppProviders`.
  - Register tags after analytics enqueue and offline review enqueue.

- [ ] **Step 5: Run focused web tests and verify GREEN**
  - Run: `pnpm --filter @wordscodex/web test -- BackgroundSyncController.test.tsx track-event.test.ts StudySessionPage.test.tsx providers.test.tsx`
  - Expected: pass.

### Task 4: Documentation and Full Verification

**Files:**
- Modify: `docs/DEVELOPMENT.md`

- [ ] **Step 1: Update documentation**
  - Mark Stage 3 Background Sync, batch analytics flush, and analytics summary as landed first versions.
  - Keep Stage 4 remaining work scoped to production hardening, privacy review, and metrics UI.

- [ ] **Step 2: Run full verification**
  - Run: `pnpm format`
  - Run: `pnpm lint`
  - Run: `pnpm typecheck`
  - Run: `pnpm test`
  - Run: `pnpm build`
  - Run: `pnpm test:e2e`
  - Run: `git diff --check`

- [ ] **Step 3: Mobile browser smoke check**
  - Build/preview and verify the 390px homepage still renders.
