# Local PHI Detection Assistance Design

**Status:** Implementation authorized by the Image Sanitize Build 2 manual-acceptance change
**Classification:** Architectural / Privacy / Clinical Imaging / Local OCR

## Decision

Use a bundled, English-only Tesseract.js WebAssembly worker in the browser. The worker, core, and trained-data assets are packaged locally and loaded only on explicit Image Sanitize selection. No image bytes or OCR text leave the browser session. Windows.Media.Ocr is not usable from the browser UI without adding a new helper image API, so it is rejected for this checkpoint.

OCR results are normalized to text, confidence, and source-pixel bounding boxes. A separate conservative classifier labels each result `LIKELY_PHI`, `POSSIBLE_PHI`, or `NOT_CLASSIFIED` using context labels and value-shape patterns. Raw OCR text is transient UI input only; session snapshots expose counts, labels, rectangles, and abbreviated candidate IDs, never OCR strings.

The analyst may select individual findings, approve all likely PHI, or approve all detected text. Suggested boxes are shown on the source image; selected boxes are sent as opaque rectangles to the existing fresh-canvas renderer. Export still requires current output verification, unchanged source hashing, and complete visible-image review.

## Dependency impact

The local English OCR assets add approximately 32 MB uncompressed before packaging (Tesseract.js core plus English trained data), with no administrator rights, installer, Python, Node, Java, or separately installed runtime required on the workstation. The app remains network-free for OCR.

## Explicit limits

This is detection assistance, not certification. OCR may miss text, and classification is heuristic. Synthetic replacement is not implemented. DICOM remains rejected by Image Sanitize.
