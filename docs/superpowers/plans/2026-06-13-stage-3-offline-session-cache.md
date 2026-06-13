# Stage 3 Offline Session Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cache opened study sessions in IndexedDB and recover them when the network request fails.

**Architecture:** The web client keeps the service as final source of truth. A small Dexie-backed repository stores the latest `StudySessionResponse` after a successful server load; `StudySessionPage` falls back to that cache only for session recovery and clearly marks the page as locally restored.

**Tech Stack:** React, TypeScript, TanStack Query, Dexie, Vitest, Testing Library, Playwright.

---

### Task 1: Study Session Cache Store

**Files:**
- Create: `apps/web/src/features/study/offline-session-cache.ts`
- Test: `apps/web/src/features/study/offline-session-cache.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
it('saves and loads a cached study session response by session id', async () => {
  const cache = new StudySessionCache(createTestDatabaseName())
  await cache.save(sessionResponse)
  await expect(cache.load('session_123')).resolves.toMatchObject({
    session: { id: 'session_123' },
  })
})

it('removes expired cached sessions', async () => {
  const cache = new StudySessionCache(createTestDatabaseName(), {
    now: () => new Date('2026-06-23T00:00:00.000Z'),
  })
  await cache.save(sessionResponse, new Date('2026-06-13T00:00:00.000Z'))
  await expect(cache.load('session_123')).resolves.toBeNull()
})
```

- [ ] **Step 2: Run tests and verify missing module failure**

Run: `pnpm --filter @wordscodex/web test -- offline-session-cache.test.ts`

- [ ] **Step 3: Implement Dexie cache**

Create a `StudySessionCache` class with `save`, `load`, `delete`, and `clearExpired` methods. Keep one table named `studySessions`, keyed by `sessionId`.

- [ ] **Step 4: Run tests and verify green**

Run: `pnpm --filter @wordscodex/web test -- offline-session-cache.test.ts`

### Task 2: Study Session Page Fallback

**Files:**
- Modify: `apps/web/src/features/study/StudySessionPage.tsx`
- Modify: `apps/web/src/features/study/StudySessionPage.test.tsx`

- [ ] **Step 1: Write failing component tests**

```ts
it('uses a cached session when the server request fails', async () => {
  renderStudySession(
    createStudyClient({
      getSession: vi.fn().mockRejectedValue(new Error('网络连接失败。')),
    }),
    { sessionCache: cacheWith(sessionResponse) },
  )
  expect(await screen.findByText('已从本地缓存恢复学习会话')).toBeInTheDocument()
})
```

- [ ] **Step 2: Implement fallback**

Pass a cache dependency into `StudySessionPage`, save successful server responses, and in query failure path load local cache before showing the hard error state.

- [ ] **Step 3: Run target tests**

Run: `pnpm --filter @wordscodex/web test -- StudySessionPage.test.tsx offline-session-cache.test.ts`

### Task 3: E2E And Docs

**Files:**
- Modify: `apps/web/e2e/vocabulary.spec.ts`
- Modify: `docs/DEVELOPMENT.md`

- [ ] **Step 1: Extend E2E**

After loading a study session, reload it once and assert the UI still displays server-restored state. Keep offline submit out of scope.

- [ ] **Step 2: Update docs**

Mark Stage 3 offline session cache as first-version complete and leave offline write queue as next step.

- [ ] **Step 3: Final verification**

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
