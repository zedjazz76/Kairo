# Kairo Guardian UI Gold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use inline execution under the Kairo Lean Mode override. Do not dispatch subagents. Steps use checkbox (`- [ ]`) syntax for recovery.

**Goal:** Apply the approved Guardian board visual system across Android and desktop without changing Kairo Core, relay, authentication, or evidence semantics.

**Architecture:** Add focused Android theme and Guardian component files, retain `KairoShell` as the behavioral composition root, and migrate each existing destination. Create deterministic board-derived raster resources and platform launch resources. Apply matching CSS and shell structure to the existing paired desktop host.

**Tech Stack:** Kotlin, Jetpack Compose Material 3 implementation primitives, Android adaptive icons/SplashScreen, bundled OFL Space Grotesk fonts, React, Vite, CSS, JUnit/Compose UI tests, Vitest, Playwright, ADB.

**Spec:** `docs/superpowers/specs/2026-08-25-kairo-guardian-ui-gold-design.md`

## Global Constraints

- `docs/branding/kairo-guardian-ui-layout-board.png` controls Home, Trace, and Knowledge composition; `docs/branding/kairo-guardian-brand-identity-board.png` controls material identity.
- Use exact Guardian palette values `#F7FAFC`, `#E6ECF1`, `#B8C7D3`, `#6CA0B7`, `#22D3C5`, and `#0E141B`.
- Use only exact board-derived Guardian artwork; do not generate or redraw a mascot.
- Keep APIs, persistence, Core, relay, auth behavior, PHI boundary, and Task 15 semantics unchanged.
- Use Space Grotesk only from an OFL-compatible source with its license preserved.
- Android is completed and refined on device before desktop parity.
- Kairo Lean Mode prohibits subagents and review loops; use focused tests followed by milestone gates.

---

### Task 1: Lock visual source, tokens, assets, and tests

**Files:**
- Modify: `apps/android/build.gradle.kts`, `apps/android/src/main/kotlin/kairo/android/theme/KairoTheme.kt`
- Create: `apps/android/src/main/kotlin/kairo/android/theme/GuardianTokens.kt`, `apps/android/src/main/kotlin/kairo/android/guardian/GuardianComponents.kt`
- Create: `apps/android/src/main/res/font/space_grotesk_*.ttf`, `apps/android/src/main/res/drawable*/guardian_*`, `apps/android/src/main/res/mipmap-*/ic_launcher*`, `apps/android/src/test/kotlin/kairo/android/theme/GuardianThemeTest.kt`

- [ ] Write a red Compose invariant asserting `KairoTheme` provides Guardian White background, Guardian Cyan primary, and a semantic `GuardianWordmark`.
- [ ] Run `:apps:android:testDebugUnitTest --tests '*GuardianThemeTest'` and confirm the missing component/token failure.
- [ ] Implement exact tokens, Space Grotesk font family, component primitives, and deterministic crops from the board; include the upstream OFL notice.
- [ ] Run the focused test green and build resources with `:apps:android:assembleDebug`.
- [ ] Commit `feat: establish Guardian visual system`.

### Task 2: Android platform and identity surfaces

**Files:**
- Modify: `apps/android/src/main/AndroidManifest.xml`, `apps/android/src/main/res/values/styles.xml`, `apps/android/src/main/kotlin/kairo/android/app/KairoActivity.kt`, `apps/android/src/main/kotlin/kairo/android/shell/KairoShell.kt`
- Create: `apps/android/src/main/res/values-v31/styles.xml`, adaptive icon XML and splash resources
- Test: existing `KairoActivityTest` plus Guardian composable coverage

- [ ] Write a red test for the visible `KAIRO` wordmark and retained unlock action semantics.
- [ ] Implement adaptive launcher, modern splash, and Guardian unlock composition with no authentication-flow change.
- [ ] Verify focused Android test green; build/install and capture launcher, splash, and unlock screenshots.
- [ ] Commit `feat: apply Guardian identity to Android launch and unlock`.

### Task 3: Android shell, Copilot, and Deep Analyze

**Files:**
- Modify: `apps/android/src/main/kotlin/kairo/android/shell/KairoShell.kt`
- Test: `apps/android/src/androidTest/kotlin/kairo/android/app/KairoActivityDeepAnalyzeTest.kt`, `OfflineCapabilityTest.kt`, `EvidenceNavigationTest.kt`

- [ ] Write a red semantic test for Guardian wordmark plus Quick/local, Deep Analyze, and unavailable-state labels.
- [ ] Migrate home, branded navigation, Copilot answer/input/evidence hierarchy, live Deep Analyze hero/output/fallback, and offline/loading states to Guardian components without changing callbacks.
- [ ] Run focused connected tests and capture Home, Copilot, Deep Analyze, and unavailable screenshots.
- [ ] Commit `feat: apply Guardian UI across Android reasoning surfaces`.

### Task 4: Android evidence, review, capture, and knowledge workspaces

**Files:**
- Modify: `apps/android/src/main/kotlin/kairo/android/shell/KairoShell.kt`
- Test: `MemoryInboxApprovalTest.kt`, `AndroidCopilotRetrievalProjectionTest.kt`, `EvidenceNavigationTest.kt`

- [ ] Write a red test for visible scope/state and evidence labels in the branded cards.
- [ ] Migrate Sources, Memory Inbox, Projects, Capture, Systems, Workflows, and Knowledge to Guardian information cards/chips/actions; preserve exact current/planned/project/incident/VERIFY behavior.
- [ ] Run focused connected suites and capture Sources, Memory, Projects, Capture, and a knowledge screenshot.
- [ ] Compare all device screenshots to the board, make one measured refinement pass, then commit `feat: complete Guardian Android working surfaces`.

### Task 5: Desktop Guardian parity

**Files:**
- Modify: `apps/desktop-web/index.html`, `apps/desktop-web/src/app/App.tsx`, `apps/desktop-web/src/app/DesktopBrowserApp.tsx`, feature components
- Create: `apps/desktop-web/src/guardian.css`, `apps/desktop-web/public/guardian-*`, favicon resources
- Test: existing feature, App, and E2E tests

- [ ] Write a red DOM/CSS-facing test for KAIRO branding and evidence-first Copilot shell.
- [ ] Add board-derived emblem, Space Grotesk font, dark shell, cool working panes, refined action/state classes, and desktop split-view layout without altering paired command sending.
- [ ] Run desktop unit/build/E2E suites and capture representative browser screenshots.
- [ ] Commit `feat: bring Guardian identity to desktop`.

### Task 6: Gold gate, release evidence, and closure

**Files:**
- Modify: `.superpowers/sdd/2026-08-20-kairo-v1-implementation/progress.md`
- Optional test: focused Guardian UI test records only when a defect requires a regression

- [ ] Run Android unit/core/retrieval suites, targeted connected UI/scope tests, desktop test/E2E/root suites, PHI/relay retention tests, secret scan, and `git diff --check`.
- [ ] Build a fresh debug APK, install it, authenticate normally, complete the final device smoke, and record safe screenshots outside tracked sensitive paths.
- [ ] Update the progress ledger with baseline, board, font license, palette, screenshot comparison/refinement, test results, APK, commits, final head, and debt.
- [ ] Commit `docs: close Guardian UI Gold Pass`, push `origin/kairo-v1`, and verify a clean local tree with `origin/kairo-v1` at HEAD.
