# Global Workspace Selector Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reusable Inspect and Diagnostics selector pages, designer cards/buttons, quick guides, and focused tool navigation without changing existing tool behavior.

**Architecture:** A browser-only `workspace-navigation.mjs` owns static nonclinical tool metadata and presentation transitions. Existing controllers mount once against unchanged control IDs; the router only toggles landing/tool containers, renders static guide text, and manages focus.

**Tech Stack:** Static HTML/CSS, ES modules, native `<dialog>`, Node test runner, existing Kairo browser harness.

**Spec:** `tools/hl7-toolkit/docs/specs/2026-09-07-global-workspace-selector-navigation.md`

## Global Constraints

- Preserve the current uncommitted Checkpoint 7.2 working tree.
- Do not alter parsing, protocols, network behavior, evidence semantics, profiles, cases, persistence, or privacy boundaries.
- Do not duplicate or remount tools; navigation only shows, hides, and focuses existing containers.
- No navigation or guide action may run a tool or create network traffic.
- No implementation commit before real Windows manual acceptance.
- Use sequential TDD; no subagents, parallel agents, or extra worktrees.

---

### Task 1: Pure workspace navigation registry and state transitions

**Files:**
- Create: `tools/hl7-toolkit/hl7-toolkit/app/scripts/workspace-navigation.mjs`
- Create: `tools/hl7-toolkit/tests/hl7-toolkit/workspace-navigation.test.mjs`

**Interfaces:**
- Produces: `WORKSPACE_TOOLS`, `createWorkspaceNavigation(root)`, and controller methods `showWorkspace(id)`, `openTool(workspaceId, toolId)`, `backToWorkspace(workspaceId)`, `openGuide(workspaceId, toolId, invoker)`, `closeGuide()`, `getState()`.
- Consumes: static DOM hooks only; no feature controller.

- [x] Write tests proving exact Inspect/Diagnostics inventories, direct-workspace routing, explicit Open/Back transitions, one visible tool, guide rendering/close/focus restoration, missing-target fail-closed behavior, and no synthetic click dispatch.
- [x] Run `node --test tests/hl7-toolkit/workspace-navigation.test.mjs`; verify RED because the module is absent.
- [x] Implement the static registry, presentation-only state machine, safe text rendering, and focus management. Registry entries include exact descriptions, synthetic examples, and five guide sections from the approved spec.
- [x] Re-run the focused test; verify GREEN.

### Task 2: Markup integration without tool duplication

**Files:**
- Modify: `tools/hl7-toolkit/hl7-toolkit/app/index.html`
- Modify: `tools/hl7-toolkit/tests/hl7-toolkit/ui-contract.test.mjs`

**Interfaces:**
- Consumes: registry/router hooks from Task 1.
- Produces: `#inspect-landing`, `#diagnostics-landing`, shared card hosts, `.tool-view` wrappers with static workspace/tool IDs, breadcrumbs/back buttons, and `#tool-guide-dialog`.

- [x] Add failing static contract tests for removal of redundant DICOM nav, exact selector/tool wrappers, one shared dialog, breadcrumbs/back controls, unchanged existing tool control IDs, direct workspace classification, and global Quick Sanitize.
- [x] Run `node --test tests/hl7-toolkit/ui-contract.test.mjs`; verify RED on missing selector contracts.
- [x] Restructure only presentation containers: move the existing DICOM DOM under Inspect; wrap HL7 inspector, DICOM inspector, and six Diagnostics tools with no copied controls or changed IDs. Add empty landing card hosts and one guide dialog.
- [x] Re-run UI contract and existing DICOM, diagnostics, MWL, workflow-comparison, case, send, validation, and workbench tests; verify GREEN.

### Task 3: Application routing integration and state preservation

**Files:**
- Modify: `tools/hl7-toolkit/hl7-toolkit/app/scripts/app.mjs`
- Modify: `tools/hl7-toolkit/hl7-toolkit/app/scripts/workbench.mjs`
- Modify: `tools/hl7-toolkit/tests/hl7-toolkit/workspace-navigation.test.mjs`
- Modify: `tools/hl7-toolkit/tests/hl7-toolkit/ui-contract.test.mjs`

**Interfaces:**
- Consumes: `createWorkspaceNavigation(document)`.
- Produces: a narrow injected/delegated `showWorkspace` path; feature controllers still mount exactly once.

- [x] Add failing tests that sidebar Inspect/Diagnostics enter landing mode, DICOM opens through Inspect, Back preserves form/DOM values, top-level switching closes guides, and opening guides/tools does not invoke feature action handlers.
- [x] Run focused tests and verify RED.
- [x] Mount the router once in `app.mjs`; pass or expose only its `showWorkspace` function to workbench navigation. Retain existing Compare and History entry behavior without adding side effects to selector transitions.
- [x] Re-run focused tests and verify GREEN.

### Task 4: Shared designer card/button and focused-view styling

**Files:**
- Modify: `tools/hl7-toolkit/hl7-toolkit/app/styles/app.css`
- Modify: `tools/hl7-toolkit/tests/hl7-toolkit/ui-contract.test.mjs`

**Interfaces:**
- Consumes: shared selector/card/button/breadcrumb classes from Tasks 1–2.
- Produces: responsive three/two/one-column layout; primary, secondary, hover, focus, active, disabled, dialog, breadcrumb, and reduced-motion styles.

- [x] Add failing CSS contract tests for shared classes, responsive breakpoints, focus/active/disabled states, and `prefers-reduced-motion: reduce`.
- [x] Run the UI contract test and verify RED.
- [x] Implement restrained Kairo styling using existing semantic tokens, consistent card heights, bottom-aligned actions, accessible target sizes, and no tool-specific variants.
- [x] Re-run the UI contract and focused navigation tests; verify GREEN.

### Task 5: Real-launcher navigation regression coverage and documentation

**Files:**
- Modify: `tools/hl7-toolkit/tests/hl7-toolkit/helpers/endpoint-browser-check.mjs`
- Modify: `tools/hl7-toolkit/hl7-toolkit/VERIFICATION.md`
- Modify: `tools/hl7-toolkit/hl7-toolkit/README.md`
- Modify: `tools/hl7-toolkit/README-FIRST.md`

**Interfaces:**
- Consumes: final router and markup.
- Produces: updated Windows manual acceptance and automated real-browser expectations.

- [x] Add a failing browser/static assertion for selector landing, opening each tool, sibling hiding, breadcrumb/Back, guide non-execution, and DICOM access through Inspect.
- [x] Run the smallest available check and verify RED.
- [x] Update the browser check and documentation with exact selector navigation and real Windows manual steps; preserve the existing Checkpoint 7.2 manual gate.
- [x] Re-run the focused check where supported and verify GREEN.

### Task 6: Final automated verification and manual gate

**Files:** No production changes unless verification exposes a defect, which must return to a targeted RED/GREEN cycle.

- [x] Run `node --check` for every changed/new JavaScript module.
- [x] Run focused navigation/UI tests.
- [x] Run current Checkpoint 7.2 suites.
- [x] Run affected Stage 1–7.1 browser tests and Windows verification commands already documented by Kairo.
- [x] Run `git diff --check`, including untracked implementation files.
- [x] Confirm no new API route, storage/log/telemetry call, protocol change, or clinical-value-derived DOM ID/attribute was introduced.
- [x] Leave all implementation changes uncommitted and report exact real Windows manual acceptance steps.

## Plan Self-Review

- Spec coverage: all selector inventories, direct workspaces, guide content, navigation states, accessibility, privacy, testing, and rollback boundaries map to Tasks 1–6.
- Placeholder scan: pass; no deferred implementation instructions.
- Interface consistency: `createWorkspaceNavigation` is the sole router factory and existing feature controllers remain independent.
- Scope: UI/navigation only; no protocol, parser, evidence, persistence, or Stage 7 expansion.
- Manual gate: implementation remains uncommitted pending real Windows acceptance.
