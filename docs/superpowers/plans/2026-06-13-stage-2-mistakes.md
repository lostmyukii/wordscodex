# Stage 2 Mistakes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable mistakes loop: list `fuzzy`/`mistake`/`lapsed` words, start a `mistake_drill` session, and let the learner continue through the existing active-recall session page.

**Architecture:** Contracts define the API boundary. Fastify exposes `/api/v1/mistakes` and `/api/v1/mistakes/session` through a new mistakes module backed by Prisma. React adds a protected `/mistakes` page that consumes the new API and navigates into the existing study session route after creating a drill session.

**Tech Stack:** TypeScript, Zod, Fastify, Prisma, React, TanStack Query, Vitest, Testing Library, Playwright.

---

### Task 1: Add mistakes contracts with RED tests

**Files:**

- Create: `packages/contracts/src/mistakes.ts`
- Create: `packages/contracts/src/mistakes.test.ts`
- Modify: `packages/contracts/src/index.ts`

- [ ] **Step 1: Write the failing contract tests**

Add tests that parse a response with one `mistake` item and a drill-session request with a default limit.

Expected API shape:

```ts
{
  plan: studyPlanSchema.nullable(),
  summary: {
    total: z.number().int().nonnegative(),
    dueNow: z.number().int().nonnegative(),
  },
  items: [
    {
      word: wordSchema,
      masteryState: z.enum(['fuzzy', 'mistake', 'lapsed']),
      repetitions: 1,
      incorrectCount: 1,
      correctCount: 0,
      lastReviewedAt: '2026-06-13T00:00:00.000Z',
      nextReviewAt: '2026-06-13T00:10:00.000Z',
      lastErrorType: 'word_to_meaning',
      updatedAt: '2026-06-13T00:00:00.000Z',
    },
  ],
}
```

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @wordscodex/contracts test -- src/mistakes.test.ts
```

Expected: FAIL because `mistakes.ts` does not exist.

- [ ] **Step 3: Implement schemas and exports**

Create `mistakeMasteryStateSchema`, `mistakeListItemSchema`, `mistakeListResponseSchema`, and `createMistakeDrillSessionRequestSchema`. Export schemas and inferred types from `packages/contracts/src/index.ts`.

- [ ] **Step 4: Verify GREEN**

Run the same contracts test and expect it to pass.

---

### Task 2: Add mistakes API with RED tests

**Files:**

- Create: `apps/api/src/modules/mistakes/mistake-routes.ts`
- Create: `apps/api/src/modules/mistakes/mistake-repository.ts`
- Create: `apps/api/src/modules/mistakes/mistake-routes.test.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Write route tests first**

Test these behaviors with an in-memory repository:

1. `GET /api/v1/mistakes` returns the active plan, summary, and mistake items for the current user.
2. `POST /api/v1/mistakes/session` creates a `mistake_drill` session.
3. unauthenticated requests return `UNAUTHORIZED`.
4. no active plan returns an empty list for `GET` and `NO_ACTIVE_STUDY_PLAN` for `POST`.
5. no mistake items returns `EMPTY_MISTAKE_SESSION` for `POST`.

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @wordscodex/api test -- src/modules/mistakes/mistake-routes.test.ts
```

Expected: FAIL because the mistakes module does not exist.

- [ ] **Step 3: Implement routes**

Use the same Bearer token handling style as `study-session-routes.ts`. Parse the drill request with `createMistakeDrillSessionRequestSchema`. Return Chinese user-facing errors through `HttpError`.

- [ ] **Step 4: Implement Prisma repository**

`listMistakes` should:

- find the active plan for the user;
- query `UserWordProgress` where `masteryState in ['fuzzy', 'mistake', 'lapsed']`;
- scope by `word.vocabularyBookId = plan.vocabularyBookId`;
- sort with `sortDueReviewCandidates`;
- return `dueNow` where `nextReviewAt <= now`.

`createMistakeDrillSession` should:

- use the same candidate query;
- sort and slice by `limit`;
- create a `StudySession` with `mode = 'mistake_drill'`;
- create one `word_to_meaning` item per candidate.

- [ ] **Step 5: Register the module**

Add `mistakeRepository` to `BuildAppOptions` and register `mistakeRoutes` under `/api/v1`.

- [ ] **Step 6: Verify GREEN**

Run the mistakes route test and expect it to pass.

---

### Task 3: Add `/mistakes` Web page with RED tests

**Files:**

- Create: `apps/web/src/features/mistakes/api.ts`
- Create: `apps/web/src/features/mistakes/MistakesPage.tsx`
- Create: `apps/web/src/features/mistakes/MistakesPage.test.tsx`
- Modify: `apps/web/src/app/router.tsx`
- Modify: `apps/web/src/styles/index.css`

- [ ] **Step 1: Write component tests first**

Test these states:

1. loaded mistake list shows `错词本`, `ability`, `错词`, and `开始错词强化`;
2. clicking `开始错词强化` calls `createMistakeDrillSession({ limit: 20 })` and navigates to `/study/session/:id`;
3. no active plan shows a link to `/books`;
4. empty list shows `暂无错词`;
5. API failure shows a retry button.

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @wordscodex/web test -- src/features/mistakes/MistakesPage.test.tsx
```

Expected: FAIL because `MistakesPage` does not exist.

- [ ] **Step 3: Implement API client and page**

Create a small mistakes API client that validates responses with contracts schemas. Use TanStack Query for the list and a mutation for drill-session creation. Use the existing auth store for the access token.

- [ ] **Step 4: Register route**

Add `/mistakes` under `ProtectedRoute`.

- [ ] **Step 5: Verify GREEN**

Run the mistakes page test and expect it to pass.

---

### Task 4: Add E2E coverage and docs

**Files:**

- Create: `apps/web/e2e/mistakes.spec.ts`
- Modify: `docs/DEVELOPMENT.md`

- [ ] **Step 1: Write E2E path**

The mobile test should:

1. guest login;
2. select `cet4-core`;
3. create a plan;
4. start the first session;
5. answer `不认识` for `ability`;
6. complete remaining items;
7. open `/mistakes`;
8. verify `ability` appears;
9. start `错词强化`;
10. verify the session page shows `错词强化`.

- [ ] **Step 2: Update documentation**

Document that Stage 2 now includes first-version mistakes listing and `mistake_drill` creation. Keep offline recovery and full mistake removal rules as upcoming.

- [ ] **Step 3: Verify full suite**

Run:

```bash
pnpm exec prettier --write packages/contracts/src/mistakes.ts packages/contracts/src/mistakes.test.ts packages/contracts/src/index.ts apps/api/src/modules/mistakes/mistake-routes.ts apps/api/src/modules/mistakes/mistake-repository.ts apps/api/src/modules/mistakes/mistake-routes.test.ts apps/api/src/app.ts apps/web/src/features/mistakes/api.ts apps/web/src/features/mistakes/MistakesPage.tsx apps/web/src/features/mistakes/MistakesPage.test.tsx apps/web/src/app/router.tsx apps/web/src/styles/index.css apps/web/e2e/mistakes.spec.ts docs/DEVELOPMENT.md docs/superpowers/plans/2026-06-13-stage-2-mistakes.md
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:deploy
pnpm db:seed
pnpm test:e2e
```

---

### Success Criteria

- `GET /api/v1/mistakes` returns only the current user's active-plan fuzzy/mistake/lapsed words.
- `POST /api/v1/mistakes/session` creates a persisted `mistake_drill` session.
- `/mistakes` page handles loading, empty, error, no-plan, and populated states.
- A mobile E2E path proves an answered-wrong word appears in the mistakes page and can start drill mode.
- Full verification passes before commit.
