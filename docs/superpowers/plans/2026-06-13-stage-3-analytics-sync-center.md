# Stage 3 Analytics And Sync Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land a larger Stage 3 slice by adding analytics event ingestion plus a visible offline sync center for pending review operations.

**Architecture:** Shared contracts define stable analytics event payloads. The API accepts idempotent event writes and stores them in PostgreSQL. The Web app tracks PWA and offline queue events, retries queued analytics locally, and exposes review sync state in a compact center.

**Tech Stack:** React 19, TypeScript, Fastify, Prisma, Zod, Dexie, Vitest, Testing Library, Playwright.

---

### Task 1: Analytics Contracts And API

**Files:**
- Create: `packages/contracts/src/analytics.ts`
- Create: `packages/contracts/src/analytics.test.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260613193000_add_analytics_events/migration.sql`
- Create: `apps/api/src/modules/analytics/analytics-routes.ts`
- Create: `apps/api/src/modules/analytics/analytics-routes.test.ts`
- Create: `apps/api/src/modules/analytics/analytics-repository.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Write failing contract and route tests**

Run: `pnpm --filter @wordscodex/contracts test -- analytics.test.ts && pnpm --filter @wordscodex/api test -- analytics-routes.test.ts`

Expected: fail because analytics schemas and API routes do not exist.

- [ ] **Step 2: Implement schemas and route**

Add `createAnalyticsEventRequestSchema`, `createAnalyticsEventResponseSchema`, stable event names, private property key filtering, an optional-auth Fastify route, and a repository interface.

- [ ] **Step 3: Add Prisma model and repository**

Add `AnalyticsEvent` with unique `clientEventId`, optional `userId`, `name`, `properties`, `occurredAt`, and indexes.

- [ ] **Step 4: Verify**

Run: `pnpm --filter @wordscodex/contracts test -- analytics.test.ts && pnpm --filter @wordscodex/api test -- analytics-routes.test.ts`

Expected: pass.

### Task 2: Web Analytics Queue And Event Tracking

**Files:**
- Create: `apps/web/src/features/analytics/api.ts`
- Create: `apps/web/src/features/analytics/analytics-event-queue.ts`
- Create: `apps/web/src/features/analytics/analytics-event-queue.test.ts`
- Create: `apps/web/src/features/analytics/track-event.ts`
- Create: `apps/web/src/features/analytics/track-event.test.ts`
- Modify: `apps/web/src/app/PwaLifecycleStatus.tsx`
- Modify: `apps/web/src/app/PwaLifecycleStatus.test.tsx`
- Modify: `apps/web/src/features/study/StudySessionPage.tsx`
- Modify: `apps/web/src/features/study/StudySessionPage.test.tsx`
- Modify: `apps/web/src/features/study/OfflineReviewSyncStatus.tsx`
- Modify: `apps/web/src/features/study/OfflineReviewSyncStatus.test.tsx`

- [ ] **Step 1: Write failing queue and tracking tests**

Run: `pnpm --filter @wordscodex/web test -- analytics-event-queue.test.ts track-event.test.ts PwaLifecycleStatus.test.tsx OfflineReviewSyncStatus.test.tsx StudySessionPage.test.tsx`

Expected: fail because analytics queue/tracker and injected tracking behavior do not exist.

- [ ] **Step 2: Implement local analytics queue**

Store failed analytics events in IndexedDB with idempotent `clientEventId`, retry metadata, and ready filtering.

- [ ] **Step 3: Track PWA and offline events**

Track `pwa_install_prompt_shown`, `pwa_installed`, `offline_queue_created`, and `offline_queue_synced` without uploading answer text.

- [ ] **Step 4: Verify**

Run: targeted Web tests.

Expected: pass.

### Task 3: Sync Progress Center

**Files:**
- Modify: `apps/web/src/features/study/offline-review-queue.ts`
- Modify: `apps/web/src/features/study/offline-review-queue.test.ts`
- Create: `apps/web/src/features/study/OfflineSyncCenter.tsx`
- Create: `apps/web/src/features/study/OfflineSyncCenter.test.tsx`
- Modify: `apps/web/src/app/providers.tsx`
- Modify: `apps/web/src/app/providers.test.tsx`
- Modify: `apps/web/src/styles/index.css`
- Modify: `apps/web/e2e/vocabulary.spec.ts`

- [ ] **Step 1: Write failing queue summary and component tests**

Run: `pnpm --filter @wordscodex/web test -- offline-review-queue.test.ts OfflineSyncCenter.test.tsx providers.test.tsx`

Expected: fail because queue summary and sync center do not exist.

- [ ] **Step 2: Implement queue summary and sync center**

Expose pending count, ready count, next retry time, last error, and manual retry action.

- [ ] **Step 3: Verify**

Run targeted tests and `pnpm --filter @wordscodex/web test:e2e -- vocabulary.spec.ts`.

Expected: pass.

### Task 4: Documentation And Full Verification

**Files:**
- Modify: `docs/DEVELOPMENT.md`

- [ ] **Step 1: Update docs**

Document analytics ingestion, local queue behavior, sync center, and remaining Background Sync work.

- [ ] **Step 2: Full verification**

Run:

```bash
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:deploy
pnpm test:e2e
git diff --check
```

Expected: all pass.
