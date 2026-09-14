# Kairo HL7 Toolkit v0.7.3 — Workstation Runtime Build 4

Release state: unaccepted and superseded by Workstation Runtime Build 5. Do not transfer Build 4 to the work desktop.

The initial Image Extract & Sanitize workflow passed a real Windows manual check, but subsequent Windows acceptance identified inconsistent patient-name, MRN/Patient ID, and accession sanitization in the Build 4 candidate. Build 4 remains an immutable historical artifact, not a release for transfer. The accepted classifier fix and subsequent Windows acceptance belong to the fresh Build 5 source and package.

Build history: Build 1 is the accepted baseline. Build 2 failed manual acceptance. Build 3 was a temporary overlaid test runtime and is not a release source. Build 4 is the fresh no-PowerShell workstation package, without changing feature version 0.7.3.

Artifacts (ignored by Git):

- `tools/hl7-toolkit/dist/Kairo-HL7-Toolkit-v0.7.3-win4/`
- `tools/hl7-toolkit/dist/Kairo-HL7-Toolkit-v0.7.3-win4.zip`
- `tools/hl7-toolkit/dist/Kairo-HL7-Toolkit-v0.7.3-win4.zip.sha256`

Extract the ZIP as a complete folder, then double-click `Kairo.Helper.exe`. No PowerShell, administrator permission, installer, separately installed .NET, Node, Python, Java, WSL, Git, Codex, Windows service, registry change, or firewall change is required at runtime. The executable is unsigned and may show Unknown Publisher or SmartScreen; follow workstation policy rather than bypassing security controls.

The runtime carries no manual test images or PHI. OCR and sanitization are local and session-only. Automated extraction and identifier detection may miss information; review output before sharing. DICOM image sanitization is not included.

The release manifest includes per-file SHA-256 values and a SHA-256 fingerprint of the complete app, helper project sources, linked C# diagnostics, builder, and verifier source snapshot. The release gate verifies the staged file list, ZIP checksum, and files extracted from the ZIP against the manifest. The source base commit is historical context, not a claim that the previously uncommitted accepted source existed in that commit.
