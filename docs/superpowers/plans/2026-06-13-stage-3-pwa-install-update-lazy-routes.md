# Stage 3 PWA Install Update Lazy Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-visible PWA install/update prompts and split non-entry routes out of the first JavaScript chunk.

**Architecture:** Keep PWA lifecycle UI in a small app-level component mounted by `AppProviders`. Route code splitting stays inside `apps/web/src/app/router.tsx` with `React.lazy` and a shared loading fallback, preserving existing route paths and guards.

**Tech Stack:** React 19, React Router, TypeScript, Vite, vite-plugin-pwa, Vitest, Testing Library, Playwright.

---

### Task 1: PWA Install and Update Prompt Component

**Files:**
- Create: `apps/web/src/app/PwaLifecycleStatus.tsx`
- Create: `apps/web/src/app/PwaLifecycleStatus.test.tsx`
- Modify: `apps/web/src/app/providers.tsx`
- Modify: `apps/web/src/styles/index.css`

- [ ] **Step 1: Write failing tests**

Test install prompt behavior using a custom `beforeinstallprompt` event with `preventDefault` and `prompt`.
Test update prompt behavior by injecting `updateReady=true` and `applyUpdate`.

- [ ] **Step 2: Run red tests**

Run: `pnpm --filter @wordscodex/web test -- PwaLifecycleStatus.test.tsx`
Expected: FAIL because `PwaLifecycleStatus` does not exist.

- [ ] **Step 3: Implement component**

The component listens for `beforeinstallprompt`, stores the deferred event, renders “安装到桌面”, calls `prompt()`, and hides after accepted or dismissed. For updates, it renders “发现新版本” and calls the injected updater.

- [ ] **Step 4: Mount component**

Render `<PwaLifecycleStatus />` from `AppProviders` next to `OfflineReviewSyncStatus`.

### Task 2: Lazy Route Splitting

**Files:**
- Modify: `apps/web/src/app/router.tsx`
- Create: `apps/web/src/app/router.test.tsx`

- [ ] **Step 1: Write failing route test**

Assert `createAppRouter()` can render `/login` through the fallback and then show the login heading.

- [ ] **Step 2: Implement lazy imports**

Use `React.lazy` for protected pages and login page; keep `/` entry page eagerly imported. Wrap `RouterProvider` with `Suspense` and a `.route-status` fallback.

- [ ] **Step 3: Build to confirm chunk split**

Run: `pnpm --filter @wordscodex/web build`
Expected: exit 0 and no “Some chunks are larger than 500 kB” warning.

### Task 3: E2E and Documentation

**Files:**
- Modify: `apps/web/e2e/app-shell.spec.ts`
- Modify: `docs/DEVELOPMENT.md`

- [ ] **Step 1: Extend E2E**

Assert the app shell still loads on mobile after lazy route splitting and PWA lifecycle status is non-blocking.

- [ ] **Step 2: Update docs**

Mark Stage 3 PWA install/update first version and route-level lazy loading as landed; leave richer install analytics and Background Sync for later.

- [ ] **Step 3: Full verification**

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
