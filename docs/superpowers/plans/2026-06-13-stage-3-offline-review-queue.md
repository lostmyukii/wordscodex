# Stage 3 Offline Review Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Queue failed study review submissions in IndexedDB and sync them later with the original `Idempotency-Key`.

**Architecture:** Keep the server as the final source of truth. A domain helper handles queue deduplication and retry metadata; a Dexie-backed web repository persists pending review submissions; `StudySessionPage` shows pending answers as "待同步" and blocks session completion until queued reviews sync successfully.

**Tech Stack:** TypeScript, React, TanStack Query, Dexie, Vitest, Testing Library, Playwright.

---

### Task 1: Domain Queue Rules

**Files:**
- Create: `packages/domain/src/offline/review-queue.ts`
- Create: `packages/domain/src/offline/review-queue.test.ts`
- Modify: `packages/domain/src/index.ts`

- [ ] **Step 1: Write failing tests**

Tests cover deduping by idempotency key, stable created order, and retry metadata.

- [ ] **Step 2: Run red test**

Run: `pnpm --filter @wordscodex/domain test -- offline/review-queue.test.ts`

- [ ] **Step 3: Implement pure helpers**

Add `upsertOfflineReviewOperation`, `selectPendingOfflineReviewOperations`, and `markOfflineReviewOperationFailed`.

- [ ] **Step 4: Verify green**

Run: `pnpm --filter @wordscodex/domain test -- offline/review-queue.test.ts`

### Task 2: Dexie Pending Review Queue

**Files:**
- Create: `apps/web/src/features/study/offline-review-queue.ts`
- Create: `apps/web/src/features/study/offline-review-queue.test.ts`

- [ ] **Step 1: Write failing tests**

Tests cover enqueue dedupe, listing by session, failed retry metadata, and deleting synced records.

- [ ] **Step 2: Run red test**

Run: `pnpm --filter @wordscodex/web test -- offline-review-queue.test.ts`

- [ ] **Step 3: Implement queue repository**

Use Dexie table `pendingReviews`, keyed by `idempotencyKey`, storing `sessionId`, `review`, `createdAt`, `retryCount`, `lastError`, and `lastAttemptAt`.

- [ ] **Step 4: Verify green**

Run: `pnpm --filter @wordscodex/web test -- offline-review-queue.test.ts`

### Task 3: Study Session Pending Sync UX

**Files:**
- Modify: `apps/web/src/features/study/StudySessionPage.tsx`
- Modify: `apps/web/src/features/study/StudySessionPage.test.tsx`
- Modify: `apps/web/src/features/study/api.ts`

- [ ] **Step 1: Write failing component tests**

Tests cover failed review submission entering queue, "作答待同步" UI, session completion blocked while pending, and manual sync using original idempotency key.

- [ ] **Step 2: Implement minimal UI and sync action**

On submit failure, enqueue the review and show a pending state. Add "同步待提交作答" for the current session. On successful sync, replace the pending state with the server result and allow completion.

- [ ] **Step 3: Verify target tests**

Run: `pnpm --filter @wordscodex/web test -- StudySessionPage.test.tsx offline-review-queue.test.ts`

### Task 4: E2E And Documentation

**Files:**
- Modify: `apps/web/e2e/vocabulary.spec.ts`
- Modify: `docs/DEVELOPMENT.md`

- [ ] **Step 1: Extend E2E**

Abort the review POST once, assert "作答待同步", restore the route, click sync, then complete the session.

- [ ] **Step 2: Update docs**

Mark offline review queue first version as complete while leaving full automatic background retry and auth-expiry handling as future hardening.

- [ ] **Step 3: Final verification**

Run:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:deploy
pnpm test:e2e
git diff --check
```
