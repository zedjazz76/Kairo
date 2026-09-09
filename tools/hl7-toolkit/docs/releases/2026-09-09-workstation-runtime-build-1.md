# Kairo HL7 Toolkit v0.7.3 — Workstation Runtime Build 1

**Release type:** Workstation Runtime
**Feature version:** 0.7.3
**Runtime build:** 1
**Source feature checkpoint:** `714e5c9d24a471f0c39e95e65441d2416e65ad53`
**Manual Windows acceptance:** Passed 2026-09-09

## Accepted workstation behavior

The published, self-contained Windows x64 folder launched successfully through `Kairo.Helper.exe`. The default browser opened and Kairo loaded from the published runtime folder. Operation required no PowerShell scripts or modules, Administrator rights, UAC elevation, installer, dependency download, external runtime installation, or firewall change. No firewall prompt was observed.

## SmartScreen and publisher trust

Runtime Build 1 is unsigned. Windows SmartScreen therefore displayed an expected **Unknown Publisher** warning. The tester explicitly chose **Run anyway** on the development laptop, and Kairo then operated normally.

This warning is a code-signing and distribution-trust limitation, not a runtime or Administrator dependency. The release does not disable or bypass SmartScreen, alter Windows security policy or PowerShell execution policy, or automatically unblock files. Trusted code signing and any enterprise allowlisting process must be designed and approved separately.

## Release identity

This release remains **Kairo HL7 Toolkit v0.7.3 — Workstation Runtime Build 1**. It does not begin or claim Checkpoint 7.4, Stage 8, or feature version 0.7.4.

The accepted artifact names are:

- `Kairo-HL7-Toolkit-v0.7.3-win1/`
- `Kairo-HL7-Toolkit-v0.7.3-win1.zip`
- `Kairo-HL7-Toolkit-v0.7.3-win1.zip.sha256`
