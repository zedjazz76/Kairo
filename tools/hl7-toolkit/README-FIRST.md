# KAIRO Guardian HL7 Toolkit — laptop handoff

This package was created September 5, 2026 from commit `2c413f9` on branch `codex/hl7-toolkit-phase1`.

## Run the toolkit

1. Extract the ZIP to a local folder you can write to, such as Documents.
2. Open the `KAIRO-Guardian-HL7-Toolkit` folder.
3. Double-click `Open HL7 Toolkit.cmd`.
4. Keep the helper window open while using the browser page.

The toolkit does not require installation, compilation, administrator privileges, a Windows service, or a firewall rule. If Windows or organizational policy blocks scripts, ask your IT team rather than weakening the policy.

## Continue development

The `source` folder contains the Phase One tests, product and Phase One designs, and the implementation plan. Stage Two search and filter is complete and verified: 77 automated tests and the PowerShell service probe passed on September 5, 2026. Stage Three adds a Kairo-owned limited validation baseline and in-memory local-profile loading. Stage Four DICOM troubleshooting is approved and begins with `source/docs/specs/2026-09-05-stage-four-dicom-design.md` and `source/docs/plans/2026-09-05-stage-four-dicom.md`.

This ZIP is a clean source handoff, not a Git repository. The work-laptop Git branch remains the authoritative Git copy.

## Privacy

The package intentionally excludes `data/runtime`, saved sanitized history, endpoint profiles, browser profiles, Git internals, and unrelated MANA wiki files. The toolkit creates a new local `data/runtime` folder on first use.

Use synthetic data for initial testing. Review sanitized output before sharing, and send HL7 only to an authorized destination over an approved network.

## DICOM repair continuation — September 5, 2026

The bounded local-file loading repair passed four focused tests: the actual file-input listener loads a synthetic Part 10 File and renders Transfer Syntax (Explicit VR Little Endian) plus patient, accession, modality, study, series, and SOP metadata. Long explicit-VR header parsing and the missing Transfer Syntax display were repaired. Verification used a minimal DOM adapter on Linux; native Windows launcher/chooser and browser visual acceptance remain unverified here. See `hl7-toolkit/VERIFICATION.md` for exact results and limitations. Stop at this checkpoint; remaining Stage Four feature work was not resumed.

## Current checkpoint — DICOM redacted troubleshooting copy

Continued from `0cc7597`. The DICOM panel now prepares a read-only redacted summary, requires review before copying, and offers manual copying when clipboard access fails. Only recognized SOP class, Transfer Syntax, and modality values are retained; all other metadata and the filename are omitted. No DICOM history/persistence was added. Six DICOM tests and four existing UI-contract tests pass. Native browser/clipboard acceptance remains pending; automated coverage uses the production listeners with a minimal DOM and clipboard adapter.

User test: launch the toolkit, open DICOM, and select a synthetic Explicit VR Little Endian `.dcm`. Check the redacted preview contains technical values but no patient/instance identifiers. Confirm Copy is disabled until the review box is checked; copy and inspect the pasted summary. Select another file and confirm review resets. This is a limited text summary, not DICOM-object de-identification. The authoritative progress ledger records exact verification. Stop here for user testing; diagnostic explainers and the earlier dictionary/transfer-syntax gaps remain incomplete. Stage 5 has not started.
