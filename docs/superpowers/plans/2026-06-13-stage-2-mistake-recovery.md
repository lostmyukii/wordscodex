# Stage 2 Mistake Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make mistake drill answers flow back into SRS mastery state so mistake words stay high priority until three successful recalls, then return to normal review.

**Architecture:** Keep the rule in `packages/domain/src/srs/schedule.ts` so both API and future offline sync share one implementation. The existing study review submission path already calls `calculateSrsReview`, so changing the domain rule updates new-word, review, mixed, and mistake-drill sessions together.

**Tech Stack:** TypeScript, Vitest, Playwright, React, Fastify, Prisma.

---

### Task 1: Lock Mistake Recovery Rules In Domain Tests

**Files:**
- Modify: `packages/domain/src/srs/schedule.test.ts`
- Modify: `packages/domain/src/srs/schedule.ts`

- [x] **Step 1: Write failing tests**

Add tests proving:

1. a `mistake` word stays `mistake` after only one correct recall;
2. a `lapsed` word stays `lapsed` before the third correct recall;
3. on the third correct recall, the word returns to `learning` when the new interval is still below 14 days;
4. on the third correct recall, the word returns to `mastered` when the new interval reaches 14 days.

- [x] **Step 2: Run test to verify RED**

Run:

```bash
pnpm --filter @wordscodex/domain test -- src/srs/schedule.test.ts
```

Expected: FAIL because the current implementation returns `learning` after the first correct review of a `mistake` or `lapsed` word.

- [x] **Step 3: Implement minimal rule**

Update `resolveMasteryState` so previous `mistake`, `fuzzy`, and `lapsed` states remain in the high-priority mistake queue until `consecutiveCorrect >= 3`. Once that threshold is reached, use the existing `intervalDays >= 14 ? mastered : learning` rule.

- [x] **Step 4: Run test to verify GREEN**

Run:

```bash
pnpm --filter @wordscodex/domain test -- src/srs/schedule.test.ts
```

Expected: PASS.

### Task 2: Cover The User Path With E2E

**Files:**
- Modify: `apps/web/e2e/mistakes.spec.ts`

- [x] **Step 1: Write failing E2E assertion**

Extend the existing mistake flow so it answers the first mistake drill correctly, returns to `/mistakes`, and verifies `ability` is still visible. Then complete two more correct mistake-drill sessions and verify the empty mistake state.

- [x] **Step 2: Run target E2E after the domain fix**

Run:

```bash
pnpm test:e2e -- apps/web/e2e/mistakes.spec.ts
```

Expected: PASS, proving the browser flow keeps the mistake after one correct drill answer and removes it after the third.

- [x] **Step 3: Run full E2E**

Run:

```bash
pnpm test:e2e
```

Expected: PASS.

### Task 3: Documentation And Completion

**Files:**
- Modify: `docs/DEVELOPMENT.md`

- [x] **Step 1: Update Stage 2 status**

Document that mistake removal/demotion rules are now implemented through SRS state recovery, while alternate question types and offline session recovery remain upcoming.

- [x] **Step 2: Run full verification**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

- [x] **Step 3: Commit and push**

Commit:

```bash
git add packages/domain/src/srs/schedule.ts packages/domain/src/srs/schedule.test.ts apps/web/e2e/mistakes.spec.ts docs/DEVELOPMENT.md docs/superpowers/plans/2026-06-13-stage-2-mistake-recovery.md
git commit -m "feat: recover mistakes after repeated recall"
git push
```
