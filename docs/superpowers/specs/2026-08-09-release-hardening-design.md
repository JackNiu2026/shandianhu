# Release Hardening Design

## Goal

Prepare the existing tutoring platform for a truthful, safe beta release without
changing unrelated user-owned work. Remove the cancelled chat feature, repair
the confirmed booking and review request-contract failures, and eliminate
misleading demo fallbacks.

## Scope

### Chat removal

- Remove the mobile chat page and stylesheet.
- Remove mobile message request functions and their now-unused shared types.
- Remove the server message route and the Prisma `Message` model.
- Create a migration which drops the message table. The migration is required
  because the model has already entered the database schema.

### Request contracts

- Keep administrator booking and review schemas unchanged.
- Add separate parent-facing booking and review schemas. They accept only
  fields supplied by a parent client; identity and review author are always
  derived from the verified JWT and database record.
- Add regression tests proving that valid parent payloads do not need
  `parentId` or `author`, while incomplete payloads are rejected.

### Truthful availability states

- Do not create random diagnosis reports when the AI provider is unavailable.
  Return a typed unavailable error instead, preserve request validation, and
  never store a fabricated report.
- Do not show bundled teachers or invented platform totals when the public API
  fails or returns no active teachers. Expose an error and retry state in the
  existing pages.

### Security

- Keep the current JWT model, but make administrator login throttling key
  selection explicit: use only a trusted proxy header when `TRUST_PROXY` is
  enabled; otherwise use a bounded anonymous key.
- Remove `unsafe-eval` from CSP. Keep `unsafe-inline` temporarily because the
  current Next/Tailwind output requires it; document its removal as a later
  nonce/hash migration rather than claiming a false hardening result.
- Add AI environment variables to the production example and make diagnosis
  availability observable through an error response.

### Mobile design consolidation

- Preserve the established visual direction and existing asset references.
- Remove duplicate obsolete global overrides where a later semantic-token rule
  already supersedes them.
- Use semantic mobile color tokens in shared controls, make compact text no
  smaller than 11px, and ensure main interaction targets are at least 36px.
- Add an explicit, accessible error/retry presentation rather than silently
  substituting demo content.

### Repository hygiene

- Delete only untracked non-runtime artifacts explicitly authorized by the
  user: `.tmp-rollback/`, `packages/mobile/font-verify.html`, and
  `packages/mobile/extracted-fonts.css`.
- Preserve `archive/`, `logo.png`, the lockfile, and all existing tracked
  files. Do not delete any feature source except chat code.

## Non-goals

- Payment, teacher identity, WeChat production configuration, or a distributed
  rate-limiter are not implemented here.
- No migration is applied to a database during this work. The migration is
  generated for deployment review.
- No existing user modifications are reverted.

## Verification

1. Unit tests cover parent-facing booking/review schemas and diagnosis
   unavailable behavior.
2. Typecheck, admin tests, lint, admin build, and WeChat build are run when a
   Node/pnpm toolchain is available.
3. Repository searches confirm no application references to chat or messages.
4. Git status confirms only intended source changes and the authorized cleanup.
