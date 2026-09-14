# Workstation Runtime Build 5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce and verify a fresh Kairo HL7 Toolkit v0.7.3 self-contained win-x64 Workstation Runtime Build 5 from the current accepted source.

**Architecture:** Reuse the existing native helper, browser app, and local OCR payload without changing their behavior. Advance only the runtime identity and release tooling to a new non-overwriting win5 target; keep the historical Build 4 artifact and its verification usable. Stage from source, audit contents, verify folder/ZIP/checksum, then record Windows acceptance and push `kairo-v1`.

**Tech Stack:** Bash release builder, Node.js verifier/tests, .NET 10 self-contained `win-x64` publish, ZIP/SHA-256.

**Spec:** User's Build 5 workstation release request in this conversation.

## Global Constraints

- Feature Version: 0.7.3; Workstation Runtime Build: 5.
- Build 4 is unaccepted and must not be reused or overwritten. Build from `hl7-toolkit/app` and `runtime/Kairo.Helper` source only.
- No PowerShell, administrator access, installer, external workstation runtime, service, registry change, or firewall change.
- No test fixture, harness, PHI, log, developer path, or external OCR dependency in the package.
- Preserve the accepted Image Extract & Sanitize source, session-only mappings, and local OCR assets.

---

### Task 1: Build 5 identity and regression

**Files:** `tools/hl7-toolkit/runtime/Kairo.Helper/RuntimeIdentity.cs`, `tools/hl7-toolkit/runtime/Kairo.Helper/Kairo.Helper.csproj`, `tools/hl7-toolkit/runtime/Kairo.Helper.Tests/RuntimeIdentityTests.cs`, `tools/hl7-toolkit/tests/hl7-toolkit/workstation-build5.test.mjs`.

**Interfaces:** `RuntimeIdentity.RuntimeBuild` and the helper's assembly/file metadata must report 5, while feature version stays 0.7.3.

- [x] Add a failing Node regression for Build 5 manifest identity and a failing .NET assertion for Build 5 helper identity.
- [x] Run those focused tests and confirm they fail on Build 4 values.
- [x] Advance identity and metadata to Build 5; rerun focused tests.

### Task 2: Fresh builder and verifier

**Files:** `tools/hl7-toolkit/build-workstation-runtime.sh`, `tools/hl7-toolkit/verify-workstation-release.mjs`, `tools/hl7-toolkit/tests/hl7-toolkit/workstation-build5.test.mjs`.

**Interfaces:** Builder creates only `dist/Kairo-HL7-Toolkit-v0.7.3-win5/`, `.zip`, `.zip.sha256`; verifier compares every staged/extracted file against `RELEASE-MANIFEST.json` and confirms checksum.

- [x] Add a failing test for Build 5 manifest identity; add package-content, no-overwrite, and ZIP integrity checks before release handoff.
- [x] Change only the builder target/docs/manifest to 5 and make manifest verification recognize preserved Build 4 plus new Build 5.
- [x] Run focused release tests; do not change or delete any previous build artifact.

### Task 3: Package, audit, verify, and record

**Files:** generated win5 artifact trio and `tools/hl7-toolkit/docs/releases/2026-09-14-workstation-runtime-build-5.md`.

**Interfaces:** Workstation extracts the complete ZIP and double-clicks `Kairo.Helper.exe`.

- [x] Run focused OCR, image extraction/sanitization, text/table, release, syntax, .NET runtime, and `git diff --check` checks.
- [x] Execute `bash build-workstation-runtime.sh` once after confirming win5 targets do not exist.
- [x] Verify manifest, extracted ZIP, checksum, local OCR asset paths/version compatibility, clean data, and absence of forbidden content.
- [x] Record the user's real Windows manual OCR/extraction/sanitization acceptance and Build 5 state without claiming work-desktop acceptance.
- [ ] Commit only accepted source, tests, release tooling, and release documentation; push `kairo-v1`; stop.
