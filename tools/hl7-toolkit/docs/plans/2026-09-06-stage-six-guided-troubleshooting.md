# Stage Six Guided Troubleshooting — First Checkpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one session-local troubleshooting case that can collect a manual note and one existing diagnostic, show a timeline and four-part analysis, and generate a technical handoff.

**Architecture:** Keep case behavior in a pure `case-model.mjs` module and DOM wiring in `case-ui.mjs`. Diagnostics exposes only an allowlisted snapshot through an explicit browser event; the existing app mounts the new controller and workspace without altering prior execution paths.

**Tech Stack:** Browser ES modules, existing local HTML/CSS/navigation, Node `node:test`.

**Spec:** `docs/specs/2026-09-06-stage-six-guided-troubleshooting.md`

## Global Constraints

- Additive only; preserve all Stage 1–5 behavior and UI patterns.
- Standard-user and local/session-only operation; no automatic persistence or transmission.
- No background work, probes, scanning, discovery, remediation, or raw PHI-bearing evidence.
- Stop after the first user-testable checkpoint; do not implement case history, advanced checklist automation, Stage Seven, or unrelated refactors.

---

### Task 1: Pure case model and safe evidence timeline

**Files:**
- Create: `hl7-toolkit/app/scripts/case-model.mjs`
- Create: `tests/hl7-toolkit/case-model.test.mjs`

**Interfaces:**
- Produces: `createCase(fields, now)`, `addManualNote(caseData, note, now)`, `attachDiagnostic(caseData, snapshot, note, now)`, `summarizeCase(caseData)`, and `formatHandoff(caseData, summary)`.
- Diagnostic snapshot accepts only type, timestamp, endpoint, classification, observed strings, baseline-change strings, likely boundary, missing evidence, and next check.

- [x] Write focused failing tests for bounded case creation, PHI/secret-pattern rejection, immutable manual-note insertion, allowlisted diagnostic attachment, chronological timeline output, four-part conservative summary, and required handoff headings.
- [x] Run `node --test tests/hl7-toolkit/case-model.test.mjs` and confirm failure because the module is missing.
- [x] Implement the minimum pure model and safe formatting functions.
- [x] Rerun the focused model test and confirm it passes.

### Task 2: Existing Diagnostics attachment boundary

**Files:**
- Modify: `hl7-toolkit/app/index.html`
- Modify: `hl7-toolkit/app/scripts/diagnostics-ui.mjs`
- Modify: `tests/hl7-toolkit/diagnostics-ui.test.mjs`

**Interfaces:**
- Produces: a `kairo:diagnostic-evidence` browser event containing the allowlisted current diagnostic snapshot only after the user selects **Add current diagnostic to case**.
- Consumes: the existing `lastDiagnostic`, baseline comparison, and Stage 5 correlation result.

- [x] Add a failing UI test proving attachment is explicit, includes safe technical fields, and excludes raw results/details.
- [x] Run the focused diagnostics UI test and confirm the missing-control/event failure.
- [x] Add the single Diagnostics button and event dispatch without changing diagnostic execution.
- [x] Rerun the focused diagnostics UI test and confirm it passes.

### Task 3: Case workspace and handoff UI

**Files:**
- Create: `hl7-toolkit/app/scripts/case-ui.mjs`
- Create: `tests/hl7-toolkit/case-ui.test.mjs`
- Modify: `hl7-toolkit/app/index.html`
- Modify: `hl7-toolkit/app/scripts/app.mjs`

**Interfaces:**
- Consumes: the Task 1 model functions and Task 2 `kairo:diagnostic-evidence` event.
- Produces: existing-navigation Case workspace with case form, manual-note control, evidence timeline, four-section summary, and handoff output.

- [x] Add a failing DOM-controller test for create case, add note, receive one diagnostic event, render timeline, generate summary, and generate handoff.
- [x] Run the focused case UI test and confirm failure because the controller/workspace is missing.
- [x] Implement the minimum workspace/controller and mount it from `app.mjs`.
- [x] Rerun focused model, Diagnostics UI, and Case UI tests and confirm they pass.

### Task 4: Checkpoint verification and authoritative handoff

**Files:**
- Modify: `README-FIRST.md`
- Modify: `hl7-toolkit/README.md`
- Modify: `hl7-toolkit/VERIFICATION.md`
- Modify: this plan's task checkboxes.

**Interfaces:**
- Produces: exact manual Windows test steps and an explicit record that later Stage 6 capabilities remain unimplemented.

- [x] Run `node --check` for the modified/new browser modules.
- [x] Run `node --test tests/hl7-toolkit/case-model.test.mjs tests/hl7-toolkit/case-ui.test.mjs tests/hl7-toolkit/diagnostics-ui.test.mjs`.
- [x] Run `git diff --check` and inspect the scoped diff.
- [x] Update authoritative checkpoint docs with actual results and Windows verification limitation.
- [x] Real Windows standard-user manual verification passed for case creation, a manual evidence note, explicit diagnostic attachment, chronological timeline, four-part case-aware guidance, complete handoff, and session-local behavior. Stop; do not begin case history or Stage Seven.
