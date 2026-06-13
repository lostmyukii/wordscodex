# Stage 3 Auto Offline Review Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first background sync layer for pending offline review submissions.

**Architecture:** Keep retry/backoff selection in `packages/domain`, IndexedDB persistence in `apps/web/src/features/study/offline-review-queue.ts`, and browser lifecycle wiring in a small app-level sync component. The manual sync button remains as a visible fallback.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Dexie, Playwright.

---

### Task 1: Domain Retry Readiness

**Files:**
- Modify: `packages/domain/src/offline/review-queue.ts`
- Test: `packages/domain/src/offline/review-queue.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
it('treats never-attempted offline review operations as ready', () => {
  expect(isOfflineReviewOperationReady({ operation: baseOperation, now: '2026-06-13T08:00:00.000Z' })).toBe(true)
})

it('backs off recently failed offline review operations exponentially', () => {
  expect(isOfflineReviewOperationReady({
    operation: { ...baseOperation, retryCount: 2, lastAttemptAt: '2026-06-13T08:00:00.000Z' },
    now: '2026-06-13T08:03:00.000Z',
  })).toBe(false)
})
```

- [ ] **Step 2: Run red test**

Run: `pnpm --filter @wordscodex/domain test -- offline/review-queue.test.ts`
Expected: FAIL because `isOfflineReviewOperationReady` does not exist.

- [ ] **Step 3: Implement readiness function**

Add an exported pure function that returns true when `lastAttemptAt` is null, otherwise waits `baseDelayMs * 2 ** (retryCount - 1)` capped by `maxDelayMs`.

- [ ] **Step 4: Run green test**

Run: `pnpm --filter @wordscodex/domain test -- offline/review-queue.test.ts`
Expected: PASS.

### Task 2: Queue Ready Listing

**Files:**
- Modify: `apps/web/src/features/study/offline-review-queue.ts`
- Test: `apps/web/src/features/study/offline-review-queue.test.ts`
- Modify: `apps/web/src/features/study/StudySessionPage.test.tsx`

- [ ] **Step 1: Write failing test**

```ts
it('lists only pending reviews whose retry delay has elapsed', async () => {
  const queue = new OfflineReviewQueue({ databaseName: createDatabaseName(), now: () => new Date('2026-06-13T08:03:00.000Z') })
  await queue.enqueue({ sessionId: 'session_123', idempotencyKey: 'ready', review, lastError: null })
  await queue.enqueue({ sessionId: 'session_123', idempotencyKey: 'blocked', review, lastError: null })
  await queue.markFailed('blocked', '网络连接失败。')
  await expect(queue.listReady()).resolves.toMatchObject([{ idempotencyKey: 'ready' }])
})
```

- [ ] **Step 2: Run red test**

Run: `pnpm --filter @wordscodex/web test -- offline-review-queue.test.ts`
Expected: FAIL because `listReady` does not exist.

- [ ] **Step 3: Implement `listReady(limit = 20)`**

Read all `pendingReviews`, filter with `isOfflineReviewOperationReady`, sort by created time through `selectPendingOfflineReviewOperations`, and return the requested limit.

- [ ] **Step 4: Update test mocks**

Add `listReady: vi.fn().mockResolvedValue([])` to all `OfflineReviewQueueClient` test doubles.

### Task 3: Auto Sync Service and Provider Wiring

**Files:**
- Create: `apps/web/src/features/study/offline-review-sync.ts`
- Test: `apps/web/src/features/study/offline-review-sync.test.ts`
- Create: `apps/web/src/features/study/OfflineReviewSyncStatus.tsx`
- Test: `apps/web/src/features/study/OfflineReviewSyncStatus.test.tsx`
- Modify: `apps/web/src/app/providers.tsx`
- Modify: `apps/web/src/features/study/api.ts`
- Test: `apps/web/src/features/study/api.test.ts`

- [ ] **Step 1: Write failing service tests**

Cover successful sync with original idempotency key, retry metadata on network failure, and auth-required pause when `StudyApiError.code === 'UNAUTHORIZED'`.

- [ ] **Step 2: Run red service tests**

Run: `pnpm --filter @wordscodex/web test -- offline-review-sync.test.ts api.test.ts`
Expected: FAIL because the service and coded `StudyApiError` do not exist yet.

- [ ] **Step 3: Implement service**

`syncOfflineReviewQueue` calls `queue.listReady(20)`, submits each review through `studyApi.submitReview`, deletes synced records, records failed attempts, and returns `idle | synced | failed | auth_required`.

- [ ] **Step 4: Wire React status component**

`OfflineReviewSyncStatus` triggers sync on mount and `window.online`; it skips work without an access token or when the browser is offline. If auth fails, it pauses retrying with the same token and shows a Chinese prompt.

- [ ] **Step 5: Mount provider component**

Render `<OfflineReviewSyncStatus />` inside `AppProviders` below `children`.

### Task 4: E2E and Documentation

**Files:**
- Modify: `apps/web/e2e/vocabulary.spec.ts`
- Modify: `docs/DEVELOPMENT.md`

- [ ] **Step 1: Extend E2E**

After a review POST is aborted, remove the route and dispatch an online event. Assert that `已自动同步 1 条离线作答` appears and that the session can complete.

- [ ] **Step 2: Update docs**

Mark Stage 3 background auto sync first version as landed, while leaving service worker Background Sync and richer analytics for later.

- [ ] **Step 3: Verify**

Run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
git diff --check
```

Expected: all commands exit 0; build may still warn about chunk size until route lazy loading lands.
