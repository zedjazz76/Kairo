# Image OCR Identifier Pairing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sanitize labeled patient identifiers consistently in extracted OCR text and bounded tables, without changing OCR or packaging Build 4.

**Architecture:** Keep OCR line and word extraction unchanged. Extend the existing `image-content.mjs` sanitizer with explicit label aliases and conservative adjacent-line pairing. Keep replacement maps session-local and reuse the existing table header classification and placeholder machinery.

**Tech Stack:** Browser JavaScript modules, Node.js test runner.

**Spec:** User's 2026-09-14 manual-acceptance defect report in this conversation.

## Global Constraints

- Change only identifier classification/pairing and corresponding focused tests.
- Do not package or promote Build 4; do not touch OCR, auth, or browser launch.
- Never log source identifiers or persist session mappings.
- Preserve clinical text, bounded table behavior, and review gating.

---

### Task 1: Reproduce text-mode label failures

**Files:** Modify `tools/hl7-toolkit/tests/hl7-toolkit/image-content.test.mjs`; then modify `tools/hl7-toolkit/hl7-toolkit/app/scripts/image-content.mjs`.

**Interfaces:** `createImageContentSession().load(regions)` and `.sanitize()` return the existing extracted and sanitized objects.

- [x] Add literal synthetic assertions for `NAME`, `PATIENTID`, `ACC`, mixed case, colon/no-colon, and repeated values; retain literal expected placeholders.
- [x] Run `node --test tests/hl7-toolkit/image-content.test.mjs` from `tools/hl7-toolkit` and observe the new failures.
- [x] Add only explicit aliases and label parsing needed for these cases, preserving punctuation/spacing.
- [x] Rerun the focused test and confirm the same cases pass.

### Task 2: Reproduce split-line pairing failures

**Files:** Modify the same focused test and sanitizer files.

**Interfaces:** OCR regions remain `{text, bbox, words}`; `sanitize()` preserves extracted line order and inserts placeholders at the paired value line.

- [x] Add literal tests for `MRN` followed by `001234`, `PATIENT NAME` followed by `LAST, FIRST`, and `ACCESSION` followed by an alphanumeric value, including a nonadjacent clinical line that must remain unchanged.
- [x] Run the focused test and observe the new failures.
- [x] Pair only immediately adjacent label-only and value lines with compatible boxes; never guess unlabeled clinical prose or skip over another label.
- [x] Rerun the focused test and confirm it passes.

### Task 3: Reproduce bounded table-header failures

**Files:** Modify the same focused test and sanitizer files.

**Interfaces:** `extractImageContent(regions).table` stays `READY` only for aligned, labeled grids; `sanitizedCsv()` exports only sanitized cells.

- [x] Add a literal aligned grid with `PATIENTID`, `ACC`, and `MODALITY`, plus multiple rows and repeated values.
- [x] Run the focused test and observe the table classification failure.
- [x] Reuse the explicit alias normalization in table header classification.
- [x] Rerun the focused test and confirm text, table, and CSV omit synthetic identifiers but retain `MR`/`CT`.

### Task 4: Focused verification and Windows handoff

**Files:** No release/package files.

**Interfaces:** Existing Image Sanitize UI consumes `.sanitize()` unchanged.

- [x] Run focused content, Image Sanitize, real bundled-OCR integration, JavaScript syntax checks, and `git diff --check`.
- [x] Confirm only the expected source/test/plan files changed and no Build 4 artifact was created or modified.
- [x] Stop for Windows manual acceptance with exact steps; do not claim real Windows success from Linux tests.
