# Kairo HL7 Toolkit v0.7.3 — Workstation Runtime Build 3

**Status:** Manual-verification candidate
**Runtime predecessor:** Workstation Runtime Build 2 (`bec950d` source candidate)
**Feature version:** 0.7.3

## Candidate scope

Build 3 adds local English OCR assistance to PNG/JPEG Image Sanitize. It detects visible text regions, reports confidence, applies conservative `LIKELY_PHI`, `POSSIBLE_PHI`, and `NOT_CLASSIFIED` labels, highlights findings, and lets the analyst select individual findings, all likely PHI, or all detected text. Approved regions are permanently flattened as opaque pixel rectangles through the existing output verifier.

The workflow retains metadata verification, explicit complete-image review, source hash re-read, and new-copy download. Automated detection may miss identifying information; review completion is not a certification that an image is PHI-free, de-identified with certainty, or safe to share.

## OCR engine and workstation impact

The candidate bundles Tesseract.js 7.0.0, tesseract.js-core 6.1.2, and English `best_int` trained data. The payload is approximately 33 MB uncompressed and runs in the browser through local WebAssembly assets. It requires no administrator rights, installer, Python, Node, Java, separately installed runtime, or network access.

Windows.Media.Ocr was evaluated but not selected because it is a Windows app/WinRT API rather than a browser API and would require a new helper image-transfer surface. Synthetic replacement is not implemented.

DICOM image sanitization remains unsupported and fails closed. Build 2 is immutable and is not overwritten or promoted.
