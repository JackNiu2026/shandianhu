# Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the cancelled chat feature and make the remaining beta flows truthful, testable, and safer to deploy.

**Architecture:** Parent-facing API payloads use dedicated Zod schemas while the authenticated identity remains server-derived. Diagnosis has a typed availability boundary rather than a demo fallback. The mobile client distinguishes successful data from failures and relies on the existing semantic color tokens.

**Tech Stack:** Next.js 15 route handlers, Prisma/PostgreSQL, Zod, Vitest, Taro 4, React 18, SCSS.

---

## File Structure

- `packages/admin/src/lib/validation.ts`: Separate parent request schemas from admin CRUD schemas.
- `packages/admin/src/lib/diagnosis.ts`: Return a typed unavailable result rather than fabricated analysis.
- `packages/admin/src/__tests__/release-hardening.test.ts`: Regression tests for public contracts and diagnosis availability.
- `packages/admin/src/app/api/public/{bookings,reviews}/route.ts`: Consume parent schemas.
- `packages/admin/src/app/api/diagnose/route.ts`: Map unavailable diagnosis to HTTP 503 without persistence.
- `packages/admin/src/lib/auth.ts` and `packages/admin/src/app/api/auth/login/route.ts`: Bound login throttling client keys.
- `packages/admin/next.config.ts` and `.env.production.example`: CSP and AI environment documentation.
- `packages/admin/prisma/schema.prisma` and `packages/admin/prisma/migrations/20260809_remove_message/migration.sql`: Remove cancelled message persistence.
- `packages/mobile/src/services/api.ts`, `packages/mobile/src/hooks/index.ts`, and page components: Remove chat calls and expose retryable data errors.
- `packages/mobile/src/app.config.ts`, `packages/mobile/src/pages/chat/*`, `packages/admin/src/app/api/messages/route.ts`: Remove chat routing and code.
- `packages/mobile/src/app.scss`: Consolidate shared control tokens and accessibility baselines.

### Task 1: Establish Contract Regression Tests

**Files:**
- Create: `packages/admin/src/__tests__/release-hardening.test.ts`
- Modify: `packages/admin/src/lib/validation.ts`
- Modify: `packages/admin/src/lib/diagnosis.ts`

- [ ] **Step 1: Write failing tests for parent payloads and unavailable diagnosis**

```ts
import { describe, expect, it } from "vitest";
import { parentBookingSchema, parentReviewSchema } from "@/lib/validation";
import { generateDiagnosis, DiagnosisUnavailableError } from "@/lib/diagnosis";

describe("parent public request contracts", () => {
  it("accepts booking input without parentId", () => {
    expect(parentBookingSchema.safeParse({ teacherId: "teacher-1", subject: "数学", slot: "周六 10:00" }).success).toBe(true);
  });

  it("accepts review input without author", () => {
    expect(parentReviewSchema.safeParse({ teacherId: "teacher-1", text: "认真负责", rating: 5 }).success).toBe(true);
  });
});

it("does not fabricate a diagnosis when AI is unavailable", async () => {
  await expect(generateDiagnosis({ subject: "数学", grade: "初中", images: ["data:image/png;base64,AA=="] }))
    .rejects.toBeInstanceOf(DiagnosisUnavailableError);
});
```

- [ ] **Step 2: Run the test and verify it fails because the schemas and error do not exist**

Run: `pnpm --filter admin test -- release-hardening.test.ts`

Expected: failed imports for `parentBookingSchema`, `parentReviewSchema`, and `DiagnosisUnavailableError`.

- [ ] **Step 3: Add the minimal parent schemas and typed diagnosis error**

```ts
export const parentBookingSchema = createBookingSchema.omit({ parentId: true });
export const parentReviewSchema = createReviewSchema.omit({ author: true });

export class DiagnosisUnavailableError extends Error {
  constructor() {
    super("诊断服务暂不可用，请稍后重试");
    this.name = "DiagnosisUnavailableError";
  }
}
```

Change `generateDiagnosis` to call the AI provider only when `AI_API_KEY` is configured, and throw `DiagnosisUnavailableError` for a missing key or provider failure. Remove demo report generation and artificial delay.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `pnpm --filter admin test -- release-hardening.test.ts`

Expected: 3 passing tests.

### Task 2: Apply Parent Contracts and Diagnosis Availability

**Files:**
- Modify: `packages/admin/src/app/api/public/bookings/route.ts`
- Modify: `packages/admin/src/app/api/public/reviews/route.ts`
- Modify: `packages/admin/src/app/api/diagnose/route.ts`

- [ ] **Step 1: Replace public route schema imports**

```ts
import { parentBookingSchema } from "@/lib/validation";
// ...
const result = parentBookingSchema.safeParse(body);
```

```ts
import { parentReviewSchema } from "@/lib/validation";
// ...
const result = parentReviewSchema.safeParse(body);
```

- [ ] **Step 2: Return an explicit 503 without storing a report**

```ts
import { DiagnosisUnavailableError, generateDiagnosis } from "@/lib/diagnosis";

// inside POST catch
if (error instanceof DiagnosisUnavailableError) {
  return NextResponse.json({ error: error.message }, { status: 503 });
}
```

- [ ] **Step 3: Run the focused test and typecheck**

Run: `pnpm --filter admin test -- release-hardening.test.ts`

Run: `pnpm --filter admin typecheck`

Expected: focused tests and admin typecheck pass.

### Task 3: Remove Chat Persistence and Clients

**Files:**
- Delete: `packages/mobile/src/pages/chat/index.tsx`
- Delete: `packages/mobile/src/pages/chat/index.scss`
- Delete: `packages/admin/src/app/api/messages/route.ts`
- Modify: `packages/mobile/src/services/api.ts`
- Modify: `packages/admin/prisma/schema.prisma`
- Create: `packages/admin/prisma/migrations/20260809_remove_message/migration.sql`

- [ ] **Step 1: Remove chat-only mobile imports, interfaces, and functions**

Delete `fetchMessages` and `sendMessage` from `api.ts`, including their message response interfaces. No callers may remain.

- [ ] **Step 2: Remove message storage from the Prisma schema**

Delete `MessageRole` and the complete `Message` model. Do not change teacher, parent, booking, review, or diagnosis models.

- [ ] **Step 3: Add an explicit destructive migration**

```sql
DROP INDEX IF EXISTS "Message_senderId_idx";
DROP INDEX IF EXISTS "Message_receiverId_idx";
DROP INDEX IF EXISTS "Message_createdAt_idx";
DROP INDEX IF EXISTS "Message_read_idx";
DROP TABLE IF EXISTS "Message";
```

- [ ] **Step 4: Search for dead references and typecheck**

Run: `rg -n "fetchMessages|sendMessage|/api/messages|pages/chat|MessageRole|prisma\.message" packages`

Expected: no matches.

Run: `pnpm typecheck`

Expected: no type errors.

### Task 4: Make Client Data Failures Explicit

**Files:**
- Modify: `packages/mobile/src/hooks/index.ts`
- Modify: `packages/mobile/src/pages/match/index.tsx`
- Modify: `packages/mobile/src/pages/me/index.tsx`
- Modify: `packages/mobile/src/app.scss`

- [ ] **Step 1: Remove fabricated state from data hooks**

Initialize teachers as an empty list and platform statistics as `null`. On failed API calls set a Chinese error message; on successful empty teacher results preserve the empty list. Return `retry`/`reload` callbacks.

- [ ] **Step 2: Render explicit loading, empty, and error states**

In the match page, render a `data-state` block with the hook error and a retry button before teacher cards. In the profile page, render platform metrics only when the stats hook returns data; otherwise render the same retryable error state. Do not render bundled teachers or baseline totals.

- [ ] **Step 3: Add shared state styles using existing semantic tokens**

```scss
.data-state {
  min-height: 96px;
  display: grid;
  place-items: center;
  gap: 10px;
  padding: 16px;
  border: 1PX solid var(--ink);
  border-radius: 12px;
  background: var(--surface-paper);
  color: var(--ink-muted);
  font-size: 13px;
}
```

- [ ] **Step 4: Run mobile typecheck and visually inspect the normal, empty, and error branches**

Run: `pnpm --filter mobile typecheck`

Expected: no type errors.

### Task 5: Security and Style Consolidation

**Files:**
- Modify: `packages/admin/src/app/api/auth/login/route.ts`
- Modify: `packages/admin/next.config.ts`
- Modify: `.env.production.example`
- Modify: `packages/mobile/src/app.scss`

- [ ] **Step 1: Bound the login throttle client key**

```ts
function getThrottleKey(request: NextRequest): string {
  if (process.env.TRUST_PROXY === "true") {
    return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  }
  return "anonymous";
}
```

Use `getThrottleKey(request)` in place of directly reading `x-forwarded-for`.

- [ ] **Step 2: Remove CSP eval and document production configuration**

Change CSP `script-src` to omit `'unsafe-eval'`. Add `TRUST_PROXY`, `AI_API_KEY`, `AI_API_URL`, and `AI_MODEL` comments to `.env.production.example`; preserve existing required variables.

- [ ] **Step 3: Consolidate mobile shared styles without changing page-specific layout**

Remove superseded duplicate global declarations for `.wordmark`, `.app-shell`, `.phone-frame`, and shared controls only when the later semantic-token rule has identical functional coverage. Normalize shared helper text to at least 11px and shared icon buttons to at least 36px.

- [ ] **Step 4: Run lint and format check**

Run: `pnpm lint:admin`

Run: `pnpm format:check`

Expected: both pass without warnings.

### Task 6: Authorized Cleanup and Final Verification

**Files:**
- Delete: `.tmp-rollback/`
- Delete: `packages/mobile/font-verify.html`
- Delete: `packages/mobile/extracted-fonts.css`

- [ ] **Step 1: Confirm every cleanup target is untracked and non-runtime**

Run: `git status --short`

Expected: each target has a `??` entry and no application imports reference either font verification file.

- [ ] **Step 2: Delete only the authorized targets**

Remove the explicit three paths. Do not alter `archive/`, `logo.png`, `pnpm-lock.yaml`, or any tracked artifact.

- [ ] **Step 3: Run all available verification commands**

Run: `pnpm typecheck`

Run: `pnpm --filter admin test`

Run: `pnpm lint:admin`

Run: `pnpm build:admin`

Run: `pnpm build:weapp`

Expected: all commands pass. If the environment has no Node/pnpm toolchain, record the exact blocker and complete static reference searches.

- [ ] **Step 4: Review scope**

Run: `git diff --check`

Run: `git status --short`

Expected: no whitespace errors and no cleanup outside the authorized paths.
