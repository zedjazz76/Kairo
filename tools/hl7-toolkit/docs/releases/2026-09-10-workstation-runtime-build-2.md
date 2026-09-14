# Kairo HL7 Toolkit v0.7.3 — Workstation Runtime Build 2

**Status:** Manual-verification candidate
**Runtime predecessor:** Workstation Runtime Build 1 (`122eb988bfa3cd8d55c74226c584b0e0f1bbcaa7`)
**Feature version:** 0.7.3

## Candidate scope

Build 2 adds the approved local PNG/JPEG Image Sanitize checkpoint to global Quick Sanitize. It supports fresh pixel encoding, source metadata-container detection without raw values, opaque flattened redactions, output verification, explicit whole-image review, new-copy downloads, and source hash revalidation.

DICOM image sanitization and OCR are not included. DICOM files fail closed as unsupported in Image Sanitize. Existing DICOM inspection and diagnostic behavior remain separate.

The assurance states are workflow evidence only. `SANITIZATION REVIEW COMPLETE` does not certify that an image is PHI-free, de-identified with certainty, or safe to share. Organizational privacy and disclosure policy still applies.

## Workstation model

The candidate remains a self-contained Windows x64 folder launched directly with `Kairo.Helper.exe`. It requires no PowerShell, Administrator rights, UAC, installer, separately installed runtime, Node, Python, Java, WSL, service, registry change, or firewall change.

The executable is unsigned. Windows SmartScreen may display the expected Unknown Publisher warning. No bypass, automatic unblocking, execution-policy change, or weakened Windows control is included.

Build 1 remains immutable. The Build 2 candidate uses distinct `win2` folder, ZIP, and checksum names.
