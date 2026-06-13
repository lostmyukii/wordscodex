# Stage 4 Launch Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the second Stage 4 launch-readiness batch: legal/account deletion entry points, production acceptance checks, backup/restore drill documentation, and release gate automation.

**Architecture:** Keep product-facing legal pages in the Web app under `features/legal`, implement account deletion as an authenticated API capability in the existing auth module, and extend the release checklist script to verify Stage 4 gates without introducing a new service. Use existing contracts, auth token flow, lazy routes, tests, and documentation patterns.

**Tech Stack:** React + TypeScript + React Router, Fastify + Prisma, Zod contracts, Vitest, Playwright, pnpm scripts.

---

### Task 1: Legal And Account Deletion UI

**Files:**
- Create: `apps/web/src/features/legal/LegalPage.tsx`
- Create: `apps/web/src/features/legal/LegalPage.test.tsx`
- Create: `apps/web/src/features/account/AccountDeletionPage.tsx`
- Create: `apps/web/src/features/account/AccountDeletionPage.test.tsx`
- Modify: `apps/web/src/app/router.tsx`
- Modify: `apps/web/src/features/home/HomePage.tsx`
- Modify: `apps/web/src/styles/index.css`

- [ ] Write failing tests for `/privacy`, `/terms`, and `/account/delete` route availability and accessible content.
- [ ] Implement lazy public legal routes and a protected account deletion route.
- [ ] Add footer links from the home page to privacy, terms, and account deletion.
- [ ] Add focused CSS for legal cards and destructive confirmation UI.
- [ ] Run Web component/router tests and keep the route chunks lazy.

### Task 2: Account Deletion API

**Files:**
- Modify: `packages/contracts/src/auth.ts`
- Modify: `apps/api/src/modules/auth/auth-service.ts`
- Modify: `apps/api/src/modules/auth/auth-repository.ts`
- Modify: `apps/api/src/modules/auth/auth-routes.ts`
- Modify: `apps/api/src/modules/auth/auth-routes.test.ts`

- [ ] Write failing route tests for `DELETE /api/v1/me` requiring Bearer auth, clearing refresh cookie, and making deleted users inaccessible.
- [ ] Add a minimal `deleteCurrentUser(accessToken)` service method.
- [ ] Add repository `deleteUser(userId)` using Prisma cascade behavior.
- [ ] Return a stable deletion response through contracts.
- [ ] Run auth route and service tests.

### Task 3: Launch Acceptance Tooling

**Files:**
- Modify: `scripts/release-readiness/checklist.ts`
- Modify: `scripts/release-readiness/checklist.test.ts`
- Create: `scripts/release-readiness/fixtures/stage4-acceptance.json`
- Modify: `README.md`
- Modify: `docs/DEVELOPMENT.md`
- Modify: `AGENTS.md`

- [ ] Write failing checklist tests for required Stage 4 gates: performance, accessibility, backup restore, staging E2E, privacy policy, user agreement, and account deletion.
- [ ] Extend `release:check` to require those gates in `docs/DEVELOPMENT.md`.
- [ ] Add a committed acceptance fixture for launch audit evidence.
- [ ] Document exact commands for release verification and the backup/restore rehearsal.
- [ ] Run root `release:check`, lint, typecheck, test, build, and e2e.

### Task 4: Browser Smoke

**Files:**
- No source file changes expected.

- [ ] Run `pnpm --filter @wordscodex/web preview --host 127.0.0.1 --port 4173`.
- [ ] Verify 390px mobile routes `/privacy`, `/terms`, and `/account/delete` load without console errors.
- [ ] Stop preview server.
