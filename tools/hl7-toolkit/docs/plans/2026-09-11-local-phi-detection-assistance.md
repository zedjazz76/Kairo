# Local PHI Detection Assistance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add local OCR and conservative PHI candidate assistance to PNG/JPEG Image Sanitize and package it as Workstation Runtime Build 3.

**Architecture:** Bundle Tesseract.js English OCR assets locally and expose a small adapter seam. Normalize OCR words into bounded source-pixel candidates, classify them conservatively, keep only privacy-safe counts/selection state public, and feed approved rectangles into the existing opaque raster export and review gates.

**Tech Stack:** Browser ES modules, Canvas 2D, bundled Tesseract.js/WebAssembly, Node built-in test runner, existing self-contained .NET runtime packaging.

**Spec:** `tools/hl7-toolkit/docs/specs/2026-09-11-local-phi-detection-assistance-design.md`

## Global Constraints

- Process one explicitly selected PNG/JPEG in browser memory only.
- No cloud OCR, remote inference, telemetry, storage, logs, or external image/text requests.
- Never claim PHI-free, certified de-identification, or safe-to-share.
- Suggested regions are reviewable; only analyst-approved opaque rectangles are exported.
- Preserve DICOM rejection and existing HL7/text Quick Sanitize behavior.
- Feature version remains 0.7.3; runtime identity becomes Build 3; win2 is immutable.

### Task 1: OCR normalization and PHI classification

- [ ] Write failing tests for bounded OCR result normalization, label/value heuristics, conservative categories, and no raw text in public projections.
- [ ] Run the focused tests RED.
- [ ] Implement the classifier and selection model.
- [ ] Run the focused tests GREEN.

### Task 2: Local OCR adapter and UI integration

- [ ] Write failing tests for injected OCR, candidate counts, approve-all/toggle behavior, overlays, stale-operation cleanup, and no-network source audit.
- [ ] Run the focused tests RED.
- [ ] Implement the browser adapter, UI controls, and integration with the existing session/raster export path.
- [ ] Run focused UI/raster/text regressions GREEN.

### Task 3: Local OCR assets and browser acceptance harness

- [ ] Vendor only the required local Tesseract.js worker/core/English assets and record their license/size inventory.
- [ ] Extend the actual-browser harness with synthetic PHI/non-PHI labels and assistance-selection checks.
- [ ] Run browser acceptance where Chromium is available; otherwise record the exact environment gate.

### Task 4: Build 3 packaging and verification

- [ ] Add failing Build 3 identity/package tests.
- [ ] Implement non-destructive Build 3 packaging and release notes.
- [ ] Build win3, preserve win1 and win2 hashes, audit the extracted package, run all focused regressions and syntax/privacy checks.
- [ ] Stop for Windows manual verification without committing or pushing.
