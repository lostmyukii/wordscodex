# Stage 1 Session Completion Result Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the first study-session loop by completing an answered session, showing a result page, and letting today's server summary expose check-in eligibility.

**Architecture:** Keep the server as the source of truth. `ReviewLog` remains append-only; completion only marks `StudySession.status = completed` after every session item has at least one synced review. The web client calls `complete` after the active recall answer, then reads the result endpoint and displays returned summary values without recomputing scheduling rules.

**Tech Stack:** React Router, TanStack Query, TypeScript, Fastify, Prisma, PostgreSQL, Zod contracts, Vitest, Testing Library, Playwright.

---

## File Map

- Modify `packages/contracts/src/study-session.ts`: add complete-session and result schemas/types.
- Modify `packages/contracts/src/auth.ts`: add `STUDY_SESSION_INCOMPLETE` API error code.
- Modify `packages/contracts/src/index.ts`: export new schemas/types.
- Modify `packages/contracts/src/study-session.test.ts`: RED/GREEN tests for result payload and error code.
- Modify `apps/api/src/modules/study-sessions/study-session-routes.ts`: add complete/result routes and incomplete-session error mapping.
- Modify `apps/api/src/modules/study-sessions/study-session-repository.ts`: complete sessions and build result summaries from `ReviewLog`.
- Modify `apps/api/src/modules/study-sessions/study-session-routes.test.ts`: route tests for incomplete completion, successful completion, result fetch, and authorization.
- Modify `apps/web/src/features/study/api.ts`: add `completeSession` and `getSessionResult`.
- Modify `apps/web/src/features/study/StudySessionPage.tsx`: show completion CTA after a synced answer and navigate to result page.
- Create `apps/web/src/features/study/StudyResultPage.tsx`: display server result summary.
- Create `apps/web/src/features/study/StudyResultPage.test.tsx`: component tests for result and error states.
- Modify `apps/web/src/features/home/HomePage.tsx`: show check-in readiness from `today.summary.canCheckIn`.
- Modify `apps/web/src/features/home/HomePage.test.tsx`: cover the completed-session/check-in state.
- Modify `apps/web/src/app/router.tsx`: add `/study/result/:sessionId`.
- Modify `apps/web/e2e/vocabulary.spec.ts`: extend first-study path through result page and return to today's completed state.
- Modify `docs/DEVELOPMENT.md`: mark complete/result endpoints as landed for Stage 1.

## Tasks

### Task 1: Contracts

- [ ] Write failing tests for `completeStudySessionResponseSchema`, `studySessionResultResponseSchema`, and `STUDY_SESSION_INCOMPLETE`.
- [ ] Run `pnpm --filter @wordscodex/contracts test -- src/study-session.test.ts` and verify RED.
- [ ] Add schemas and exports.
- [ ] Re-run contracts tests and verify GREEN.

### Task 2: API

- [ ] Write failing API route tests for `POST /study-sessions/:sessionId/complete` and `GET /study-sessions/:sessionId/result`.
- [ ] Run `pnpm --filter @wordscodex/api test -- src/modules/study-sessions/study-session-routes.test.ts` and verify RED.
- [ ] Implement repository completion/result logic.
- [ ] Implement route handlers and error mapping.
- [ ] Re-run API route tests and verify GREEN.

### Task 3: Web

- [ ] Write failing tests for completion CTA, result page, and Home check-in status.
- [ ] Run focused web tests and verify RED.
- [ ] Add study API methods, result route/page, completion mutation, and Home status.
- [ ] Re-run focused web tests and verify GREEN.

### Task 4: End-to-End

- [ ] Extend mobile E2E to click `完成会话`, verify result page, return Home, and see `可打卡`.
- [ ] Run E2E and verify GREEN.

### Task 5: Verification and Commit

- [ ] Run `pnpm exec prettier --write` on changed Markdown/TS/CSS files and `pnpm --filter @wordscodex/api exec prisma format` if schema changes.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm db:deploy`.
- [ ] Run `pnpm db:seed`.
- [ ] Run `pnpm test:e2e`.
- [ ] Use Browser at 375px to verify the first-study result flow.
- [ ] Commit and push.
