# Image Content Extraction Implementation Plan

**Goal:** Make Extract & Sanitize Content the primary PNG/JPEG workflow, retaining image-output redaction as secondary and keeping the Windows manual gate.

**Architecture:** Reuse packaged local Tesseract 6 positioned lines. Preserve line reading order for text; infer cells only from repeated, aligned word-box gaps. Sanitize text and cells with one in-memory replacement map and relative-date anchor. Never persist image, OCR text, or mappings.

**Tech Stack:** Browser ES modules, bundled Tesseract.js, Node test runner, existing Image Sanitize UI.

1. Add failing synthetic OCR extraction/sanitization tests for labels, repeats, multiple rows, tables, clinical terms, dates, contacts, identifiers, uncertainty, CSV, and clear.
2. Implement the pure bounded extraction and session sanitizer, reusing existing residual patterns and known-value index.
3. Connect real OCR word boxes and primary UI. Keep image-output redaction in a collapsed secondary area. Ensure clipboard/CSV use sanitized values only.
4. Run focused and existing regressions, syntax/privacy checks, and `git diff --check`. Stop for manual Windows acceptance; do not create Build 4.
