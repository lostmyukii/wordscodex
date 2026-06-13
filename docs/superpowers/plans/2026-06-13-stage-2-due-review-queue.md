# Stage 2 Due Review Queue Implementation Plan

> **For Yukii/Codex:** REQUIRED SUB-SKILL: Use test-driven-development while executing this plan.

**Goal:** Start Stage 2 by making due reviews a first-class learning path: due review words are scoped to the active plan, sorted by MVP mastery priority, recommended from the home page, and labelled clearly in the study UI.

**Architecture:** Keep ordering rules in `packages/domain`, let the API repository apply that ordering to due progress records, and keep React UI as a consumer of server recommendations. The server remains the source of truth.

**Tech Stack:** TypeScript, Fastify, Prisma, React, TanStack Query, Vitest, Testing Library, Playwright.

---

### Task 1: Add RED tests for due review queue behavior

**Files:**

- Create: `packages/domain/src/today/review-queue.test.ts`
- Modify: `apps/api/src/modules/study-sessions/study-session-routes.test.ts`
- Modify: `apps/web/src/features/home/HomePage.test.tsx`
- Modify: `apps/web/src/features/study/StudySessionPage.test.tsx`

**Step 1: Domain sorting tests**

Add tests that expect due review candidates to sort by:

1. `mistake`
2. `lapsed`
3. `fuzzy`
4. `learning`
5. `mastered`

Within the same mastery state, older `nextReviewAt` should come first, then older `updatedAt`, then `wordId` for deterministic ties.

**Step 2: API route tests**

Add tests that confirm `/today` recommends `mixed` when reviews and new words both exist, and `POST /study-sessions` can create a `review` session with the requested review limit.

**Step 3: Web tests**

Add tests that confirm the home page starts the server-recommended review/mixed session and the study page labels review sessions as "到期复习".

**Step 4: Run tests and confirm RED**

Run:

```bash
pnpm --filter @wordscodex/domain test -- src/today/review-queue.test.ts
pnpm --filter @wordscodex/web test -- src/features/study/StudySessionPage.test.tsx
```

Expected: failures because `review-queue` does not exist and review sessions are still labelled as generic study tasks.

---

### Task 2: Implement domain due review ordering

**Files:**

- Create: `packages/domain/src/today/review-queue.ts`
- Modify: `packages/domain/src/index.ts`

**Step 1: Define candidate type**

Include `wordId`, `masteryState`, `nextReviewAt`, and `updatedAt`.

**Step 2: Implement stable deterministic sorting**

Sort by mastery priority, then `nextReviewAt`, then `updatedAt`, then `wordId`.

**Step 3: Export from domain package**

Expose `sortDueReviewCandidates` from the package index.

---

### Task 3: Apply review ordering and active-plan scoping in API

**Files:**

- Modify: `apps/api/src/modules/study-sessions/study-session-repository.ts`

**Step 1: Scope due review counts**

Update `getTodayOverview` so `dueReviewCount` only counts progress records whose word belongs to the active plan vocabulary book.

**Step 2: Sort due review words by domain priority**

Fetch due review progress for the active plan vocabulary book, call `sortDueReviewCandidates`, then slice by `reviewLimit`.

**Step 3: Preserve new-word behavior**

Keep existing new-word selection and mixed-session merge behavior unchanged, except that reviews should be priority-ordered before new words.

---

### Task 4: Improve frontend review language

**Files:**

- Modify: `apps/web/src/features/study/StudySessionPage.tsx`

**Step 1: Add session mode labels**

Map:

- `new_words` -> `新词学习`
- `review` -> `到期复习`
- `mixed` -> `混合学习`
- `mistake_drill` -> `错词强化`

**Step 2: Use label in the study page hero**

Keep current layout, only replace generic text.

---

### Task 5: Update documentation and verify

**Files:**

- Modify: `docs/DEVELOPMENT.md`

**Step 1: Document current Stage 2 progress**

Mention that due review queue ordering and active-plan scoping have landed, while mistake drill and offline sync remain upcoming.

**Step 2: Run verification**

Run:

```bash
pnpm exec prettier --write docs/superpowers/plans/2026-06-13-stage-2-due-review-queue.md packages/domain/src/today/review-queue.ts packages/domain/src/today/review-queue.test.ts packages/domain/src/index.ts apps/api/src/modules/study-sessions/study-session-repository.ts apps/api/src/modules/study-sessions/study-session-routes.test.ts apps/web/src/features/home/HomePage.test.tsx apps/web/src/features/study/StudySessionPage.tsx apps/web/src/features/study/StudySessionPage.test.tsx docs/DEVELOPMENT.md
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:deploy
pnpm db:seed
pnpm test:e2e
```

**Step 3: Commit and push**

Commit message:

```text
feat: add due review queue
```

---

### Success Criteria

- Due reviews are scoped to the active vocabulary book.
- Due review ordering follows MVP priority: mistake, lapsed, fuzzy, learning, mastered.
- Home recommendation can start review or mixed sessions.
- Study page clearly labels review/mixed/mistake modes.
- Related tests and full verification pass.
- Development documentation reflects Stage 2 progress.
