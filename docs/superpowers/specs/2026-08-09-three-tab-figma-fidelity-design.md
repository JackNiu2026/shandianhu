# Three-Tab Figma Fidelity Design

## Goal

Make the mobile Discover, Assessment, and Profile flows visually converge on the
final Figma source while preserving the existing authenticated booking and
review integrations.

## Information Architecture

- The bottom navigation contains exactly Discover, Assessment, and Profile.
- Diagnosis is removed from the tab bar and becomes a learning-tool entry in
  the Assessment result flow.
- Cancelled chat remains absent from both navigation and route configuration.

## Visual Source of Truth

- Use the final override layer in `archive/figma/src/index.css` for navigation
  geometry, selected colours, typography, and control states.
- Establish one semantic token layer in the mobile app. Earlier duplicate
  global overrides are removed only when the later semantic rule fully replaces
  them.
- Preserve the current local logo/image assets and Taro-compatible units.

## Page Behaviour

- Discover retains real API loading, empty, and retryable error states. Those
  states use the same surface, border, spacing, and action language as the
  Figma teacher card rather than introducing a separate visual system.
- Assessment adds a diagnosis entry after a completed assessment, retaining
  the existing diagnosis route as an explicit non-tab navigation target.
- Profile does not present hard-coded teacher metrics as production data.
  Unavailable teacher data has an explicit construction/unavailable state.

## Navigation

- Discover selected: `#7056BD` on `#EEE9FF`.
- Assessment selected: `#C96542` on `#FFF0E7`.
- Profile selected: `#4E70AD` on `#EAF0FF`.
- Inactive: `#8A827A`; icon: 20px; label: 10px; tap target: at least 54px.

## Verification

- Typecheck the mobile package and build the WeChat bundle.
- Capture the three tabs at the 430px design baseline and compare their
  navigation, first content state, loading/empty/error state, and relevant
  assessment result state against Figma.
- Search confirms diagnosis is no longer a tab, while the assessment flow has
  a reachable diagnosis entry.
