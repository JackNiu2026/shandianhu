# Three-Tab Figma Fidelity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a Figma-aligned Discover, Assessment, Profile navigation and page system without replacing existing API flows.

**Architecture:** The custom tab bar owns the three-tab information architecture and per-tab visual state. Shared SCSS owns final semantic tokens and state components. Assessment remains the route that presents diagnosis as a secondary tool.

**Tech Stack:** Taro 4, React 18, TypeScript, SCSS.

---

### Task 1: Three-Tab Navigation

**Files:**
- Modify: `packages/mobile/src/app.config.ts`
- Modify: `packages/mobile/src/custom-tab-bar/index.tsx`
- Modify: `packages/mobile/src/custom-tab-bar/index.scss`

- [ ] Remove `pages/diagnose/index` from the custom tab configuration and retain only match, test, and me page paths.
- [ ] Change the tab palette to Discover `#7056BD/#EEE9FF`, Assessment `#C96542/#FFF0E7`, and Profile `#4E70AD/#EAF0FF`; use `#8A827A` inactive.
- [ ] Apply Figma final navigation geometry: 72px shell, 54px minimum button, 20px icon, 10px label, per-tab selected background and `scale(.96)` active state.
- [ ] Build the WeChat target and confirm `switchTab` references only registered tab pages.

### Task 2: Assessment Diagnosis Entry

**Files:**
- Modify: `packages/mobile/src/pages/test/index.tsx`
- Modify: `packages/mobile/src/pages/test/index.scss`

- [ ] Write a test or static assertion proving the completed-result branch exposes `Taro.navigateTo({ url: "/pages/diagnose/index" })`.
- [ ] Add a compact Figma-token card after assessment completion that opens diagnosis; it is not a tab item.
- [ ] Add matching selected, pressed, and wrapped-text styles with at least 36px touch height.
- [ ] Typecheck the mobile package.

### Task 3: Discover and Profile State Fidelity

**Files:**
- Modify: `packages/mobile/src/pages/match/index.scss`
- Modify: `packages/mobile/src/pages/me/index.tsx`
- Modify: `packages/mobile/src/pages/me/index.scss`
- Modify: `packages/mobile/src/app.scss`

- [ ] Restyle loading, empty, and retryable error states as teacher-card-adjacent surfaces using semantic tokens, compact Figma spacing, and stable height.
- [ ] Replace hard-coded teacher dashboard metrics with a construction/unavailable state while preserving the profile structure.
- [ ] Remove redundant global shared-control overrides only where a final semantic rule replaces the same properties.
- [ ] Capture/inspect Discover, Assessment, and Profile at the 430px design width.

### Task 4: Verification

**Files:**
- Test: `packages/mobile/src/app.config.ts`
- Test: `packages/mobile/src/custom-tab-bar/index.tsx`

- [ ] Run `pnpm --filter mobile typecheck`.
- [ ] Run `pnpm --filter mobile build:weapp` with a configured `WECHAT_APPID`.
- [ ] Run `rg -n 'pages/diagnose/index' packages/mobile/src/app.config.ts packages/mobile/src/custom-tab-bar` and confirm no tab reference remains.
- [ ] Run `git diff --check` scoped to touched mobile files and review status for unintended changes.
