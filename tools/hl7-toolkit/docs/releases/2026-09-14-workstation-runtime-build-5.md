# Kairo HL7 Toolkit v0.7.3 — Workstation Runtime Build 5

Release state: ready for work-desktop transfer; work-desktop operation has not yet been observed.

The user reported real Windows manual acceptance in the normal authenticated Kairo runtime for local OCR and the primary Image Extract & Sanitize workflow. That acceptance includes patient names, MRN/Patient ID, accession, supported dates, consistent repeated placeholders, preserved modality/procedure text, text mode, and bounded table/cell mode. It is a report of laptop acceptance, not a claim that this new Build 5 package has already run on the work desktop.

Build history: Build 1 is the accepted no-PowerShell baseline. Build 2 failed manual acceptance. Build 3 was a debugging/overlay test runtime. Build 4 is unaccepted and must not be used for transfer. A first-pass Build 5 candidate was rejected after a focused code-review regression and retained under a hidden `dist/.rejected-win5-review-*` directory; it must not be transferred. The official Build 5 paths below were then published fresh from the corrected source tree without copying from Build 3 or Build 4; all earlier artifacts remain unchanged.

Artifacts (not stored in Git):

- `tools/hl7-toolkit/dist/Kairo-HL7-Toolkit-v0.7.3-win5/`
- `tools/hl7-toolkit/dist/Kairo-HL7-Toolkit-v0.7.3-win5.zip`
- `tools/hl7-toolkit/dist/Kairo-HL7-Toolkit-v0.7.3-win5.zip.sha256`

ZIP SHA-256: `9a39067c016a2fb7b697818ff10cc0cb26ce7e74be017df2c7c8e889d28c5999`.

The self-contained win-x64 folder contains `Kairo.Helper.exe`, the current browser app, local Tesseract.js 6.0.1/worker, compatible core 6.1.2 JS/WASM, and English traineddata. The helper serves those OCR assets from its own loopback origin. No CDN, cloud OCR, workstation PowerShell, installer, administrator privilege, or separately installed .NET/Node/Python/Java/WSL/Git/Codex runtime is required. It installs no Windows service and changes no registry or firewall setting.

The package manifest lists 259 files with size and SHA-256. Staged and extracted ZIP contents were checked against that manifest, and the ZIP checksum was verified. The package contains no test fixture, manual image, PHI, log, runtime data, or PowerShell launcher. OCR and identifier replacement remain local and session-only. Automated detection can miss identifiers; review sanitized output before sharing. DICOM image sanitization is not included.

Transfer the ZIP and checksum to the work desktop. Verify the checksum using an approved local method if required by workstation policy, extract the whole folder to a user-writable location, and double-click `Kairo.Helper.exe`. Keep the executable with its companion files. The executable is unsigned and Windows may show Unknown Publisher or SmartScreen; follow organization policy rather than bypassing a security warning.
