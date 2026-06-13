# Stage 2 Session Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore in-progress study sessions after page refresh by returning persisted review answers with the session and letting the Web UI continue from server truth.

**Architecture:** Extend `StudySessionResponse` with a `reviews` array derived from `ReviewLog` plus `UserWordProgress`. The API remains the final source of truth; the Web page merges restored server reviews with new local submissions and only enables completion when every session item has a persisted or newly submitted answer.

**Tech Stack:** TypeScript, Zod contracts, Fastify, Prisma, React, TanStack Query, Vitest, Testing Library, Playwright.

---

### Task 1: Contracts

**Files:**
- Modify: `packages/contracts/src/study-session.ts`
- Modify: `packages/contracts/src/study-session.test.ts`

- [x] **Step 1: Write failing contract test**

Add a test that parses a `StudySessionResponse` containing:

```ts
reviews: [
  {
    wordId: 'word_ability',
    questionType: 'word_to_meaning',
    rating: 'good',
    isCorrect: true,
    responseMs: 4200,
    answer: '认识',
    reviewedAt: fixedIso,
    progress: {
      masteryState: 'learning',
      repetitions: 1,
      consecutiveCorrect: 1,
      correctCount: 1,
      incorrectCount: 0,
      easeFactor: 2.3,
      intervalDays: 2,
      lastReviewedAt: fixedIso,
      nextReviewAt: '2026-06-15T00:00:00.000Z',
      averageResponseMs: 4200,
      lastErrorType: null,
    },
  },
]
```

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @wordscodex/contracts test -- src/study-session.test.ts
```

Expected: FAIL because `StudySessionResponse` does not yet expose `reviews`.

- [x] **Step 3: Implement contract schema**

Create `studySessionReviewSchema` and add `reviews: z.array(studySessionReviewSchema).default([])` to `studySessionResponseSchema`. Export the inferred `StudySessionReview` type.

- [x] **Step 4: Verify GREEN**

Run the same contracts test and expect PASS.

### Task 2: API

**Files:**
- Modify: `apps/api/src/modules/study-sessions/study-session-routes.ts`
- Modify: `apps/api/src/modules/study-sessions/study-session-routes.test.ts`
- Modify: `apps/api/src/modules/study-sessions/study-session-repository.ts`

- [x] **Step 1: Write failing route test**

Add a route test that posts a review, then calls `GET /api/v1/study-sessions/:sessionId` and expects the response `reviews[0].wordId` and `reviews[0].progress.nextReviewAt`.

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @wordscodex/api test -- src/modules/study-sessions/study-session-routes.test.ts
```

Expected: FAIL because the route currently returns only `{ session }`.

- [x] **Step 3: Implement API recovery payload**

Change repository `getSession` to return `StudySessionResponse`. In the Prisma repository, fetch latest `ReviewLog` records for the session and corresponding `UserWordProgress`, then map them to `reviews`.

- [x] **Step 4: Verify GREEN**

Run the same API test and expect PASS.

### Task 3: Web

**Files:**
- Modify: `apps/web/src/features/study/StudySessionPage.tsx`
- Modify: `apps/web/src/features/study/StudySessionPage.test.tsx`

- [x] **Step 1: Write failing component test**

Render a two-item session where `reviews` already contains the first word. Expect:

- progress text shows `已答 1 题`;
- first card buttons are disabled and feedback is visible;
- clicking `下一题` shows the second word;
- completing both answers navigates to result.

- [x] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @wordscodex/web test -- src/features/study/StudySessionPage.test.tsx
```

Expected: FAIL because the page ignores `sessionQuery.data.reviews`.

- [x] **Step 3: Implement restored review merge**

Build a restored review map from `sessionQuery.data.reviews`, merge it with local submission results, and drive `isAnswered`, `allItemsAnswered`, feedback, and progress text from the merged map.

- [x] **Step 4: Verify GREEN**

Run the same Web component test and expect PASS.

### Task 4: E2E And Docs

**Files:**
- Modify: `apps/web/e2e/vocabulary.spec.ts`
- Modify: `docs/DEVELOPMENT.md`

- [x] **Step 1: Extend E2E**

In the vocabulary learning flow, after answering the first question, reload the page and verify the restored progress before continuing the remaining questions and completing the session.

- [x] **Step 2: Verify target E2E**

Run:

```bash
pnpm test:e2e -- apps/web/e2e/vocabulary.spec.ts
```

Expected: PASS.

- [x] **Step 3: Update documentation**

Document that Stage 2 session refresh recovery now restores persisted answers from `GET /api/v1/study-sessions/:sessionId`; offline IndexedDB recovery remains a Stage 3 PWA/offline task.

- [x] **Step 4: Full verification**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

- [x] **Step 5: Commit and push**

Commit:

```bash
git add packages/contracts/src/study-session.ts packages/contracts/src/study-session.test.ts apps/api/src/modules/study-sessions/study-session-routes.ts apps/api/src/modules/study-sessions/study-session-routes.test.ts apps/api/src/modules/study-sessions/study-session-repository.ts apps/web/src/features/study/StudySessionPage.tsx apps/web/src/features/study/StudySessionPage.test.tsx apps/web/e2e/vocabulary.spec.ts docs/DEVELOPMENT.md docs/superpowers/plans/2026-06-13-stage-2-session-recovery.md
git commit -m "feat: restore in-progress study sessions"
git push
```
