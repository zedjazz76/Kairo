# Workstation Runtime Build 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the manually accepted v0.7.3 source as a fresh, independently audited, no-PowerShell win-x64 Workstation Runtime Build 4.

**Architecture:** Keep the existing self-contained .NET helper and browser app layout. Change only the runtime build identity and release builder target, make the win4 target fail if any artifact already exists, and verify the staged folder and extracted ZIP against the generated manifest. Commit accepted source and release engineering after all gates, then push `kairo-v1`.

**Tech Stack:** Bash release builder, .NET self-contained win-x64 publish, Node test runner, SHA-256, ZIP.

**Spec:** User-approved 2026-09-14 Build 4 release requirements and `tools/hl7-toolkit/docs/plans/2026-09-14-image-content-extraction.md`.

## Global Constraints

- Feature version remains 0.7.3; runtime build becomes 4.
- Build fresh from `tools/hl7-toolkit/hl7-toolkit/app` and the .NET project; never use the overlaid win3 package as input.
- Never alter win1, win2, or win3 folder/ZIP/checksum artifacts.
- Package no scripts, fixtures, harnesses, logs, PHI, or developer paths.
- No installer, PowerShell runtime, admin requirement, or separately installed runtime.
- Record manual laptop acceptance and unsigned/SmartScreen limitation.

### Task 1: Build identity and fail-if-present contract

**Files:** `runtime/Kairo.Helper/RuntimeIdentity.cs`, `runtime/Kairo.Helper/Kairo.Helper.csproj`, `runtime/Kairo.Helper.Tests/RuntimeIdentityTests.cs`, `tests/hl7-toolkit/workstation-build4.test.mjs`.

- [ ] Write a test asserting Build 4 identity and a win4-only builder target; run it RED.
- [ ] Update runtime identity and assembly/informational version to `.4`; run the test GREEN.

### Task 2: Clean package and audit

**Files:** `build-workstation-runtime.sh`, `runtime/Kairo.Helper.Tests/Packaging/PackageTests.cs`, `tests/hl7-toolkit/workstation-build4.test.mjs`.

- [ ] Extend the regression to require a non-overwriting win4 target, OCR/extraction assets, signed-off release docs, and manifest/ZIP hash verification; run it RED.
- [ ] Update the builder to publish fresh into new win4 paths, reject existing targets, write Build 4 docs and manifest, audit forbidden files/content, verify an extracted ZIP and SHA-256; run focused tests GREEN.

### Task 3: Verify, record, commit, push

**Files:** `docs/releases/2026-09-14-workstation-runtime-build-4.md` and accepted source/tests.

- [ ] Record laptop manual acceptance and Build 4 release state.
- [ ] Run Image Sanitize/OCR/extraction/sanitization tests, workstation/package tests, JS syntax, .NET tests, `git diff --check`, and manifest/checksum verification.
- [ ] Stage only accepted source, release engineering, tests, plans, and release notes; inspect the staged diff; commit and push to `kairo-v1`.
