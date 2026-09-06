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

## Current verification — real CT/MR browser path

The reported all-empty metadata failure was **not reproduced** on current `5ddf641`. The actual Windows launcher and Chrome rendered pydicom CT_small.dcm (20 metadata rows) and MR_small.dcm (19 rows), with correct modality, SOP class, Explicit VR Little Endian, and study/series/SOP instance UIDs. Accession is genuinely empty in these two fixtures. No production change was needed or made; regression fixtures and browser/file-handler checks were added. Eight focused tests and both actual-browser fixture checks passed. Exact evidence and runtime limitations are in the authoritative progress ledger.

Manual test in the already-open local toolkit at port 8765:

1. Open DICOM and click **Choose a local DICOM file**.
2. Select `tools/hl7-toolkit/tests/hl7-toolkit/fixtures/pydicom/CT_small.dcm` from this repository. From Windows on this host, the fixture folder is `\\wsl.localhost\Ubuntu\home\zedjazz\Projects\Kairo\tools\hl7-toolkit\tests\hl7-toolkit\fixtures\pydicom`.
3. Confirm CT, CT Image Storage, Explicit VR Little Endian, nonempty Study/Series/SOP Instance UID rows, and a populated tag table.
4. Select `MR_small.dcm` from the same folder. Confirm MR, MR Image Storage, and a populated table.

If the running instance is closed, launch **this checkout's** `hl7-toolkit/Open HL7 Toolkit.cmd` and use its newly opened session page. The automated browser check sets the real file input through DevTools; only native dialog interaction remains manual for this tested path. The original failure's cause is not established. Preserve the redacted-copy checkpoint; do not roll back. No additional Stage Four work is included.

## Current continuation — Stage Five blocked on product direction

The user has now confirmed the real Windows CT/MR DICOM selection workflow works. Preserve all completed Stage 1–4 work. Recovery from `4a05b68` found no approved Stage Five objective or capability assignment in the authoritative product roadmap, stage documents, or progress ledger. The older Phase 4 professional-tooling list must not be silently relabeled Stage Five. Supply the approved Stage Five objective (or its authoritative source) before implementation. No Stage Five capability or Stage Six work was started. The progress ledger records this product blocker.

## Current checkpoint — Stage Five TCP and DICOM C-ECHO

The Stage Five direction blocker is resolved by user approval. **Diagnostics** is now available in the existing toolkit. This first checkpoint adds one-endpoint TCP checks and DICOM Verification/C-ECHO, with separate DNS, TCP, association and C-ECHO results, selected address, timing, timestamp and explanations. Existing HL7 and DICOM tools are preserved.

### Test now

1. Close the old helper/browser session and double-click **this checkout's** `hl7-toolkit/Open HL7 Toolkit.cmd` normally. Do not run as Administrator.
2. Open **Diagnostics**. Enter an endpoint you are authorized to test, its port, and optionally the timeout per layer (default 3000 ms).
3. Click **Test TCP connection**. Expect `TCP_CONNECTED`, `CONNECTION_REFUSED`, `TIMEOUT`, or a DNS/network classification. No application bytes are sent; DICOM layers remain `NOT_RUN`.
4. For a DICOM endpoint, enter its **Called AE** and a **Calling AE** that it permits (default `KAIRO` may need to be changed for your site's configuration). Click **Run DICOM C-ECHO**.
5. Expect DNS → TCP → association → C-ECHO evidence. Successful Verification shows `C_ECHO_SUCCESS`; an AE rejection leaves TCP successful and reports the association reason; a later C-ECHO failure/timeout preserves the accepted association result. Later layers remain `NOT_RUN` if an earlier layer fails.

Runs use ordinary standard-user networking, one address and one connection per click. No scanning, automatic retries, patient messages/datasets, firewall changes, installed services/drivers or persistent diagnostic history. C-ECHO success does not prove storage, MWL or query/retrieve support. The initial client does not support DICOM TLS. If runtime policy blocks optional diagnostics, the UI reports unavailable and existing workspaces remain usable; do not weaken workstation security.

Verified: 13 targeted tests plus 5 real Chrome/Windows-launcher workflows against controlled loopback peers; Windows token confirmed non-elevated, and success/rejection screenshots visually inspected. A later interoperability correction changed the A-ASSOCIATE fixed-field size and AC item offset from 72 to the standard 68 bytes. Real user verification through this Kairo UI against the controlled CSOL Orthanc endpoint succeeded through DNS, TCP, association, and C-ECHO (`C_ECHO_SUCCESS`, 240 ms); independent pynetdicom returned `0x0000`. The authoritative progress ledger has exact evidence. Remaining Stage Five capabilities are HTTP/TLS, MLLP diagnostic integration, profiles, baselines and evidence correlation. Stop here; Stage Six has not started.

## Current checkpoint — Stage Five HTTP/HTTPS/TLS

The existing **Diagnostics** workspace now includes **HTTP / TLS**. Enter one authorized HTTP/HTTPS URL (a hostname alone defaults to HTTPS) and choose **Run HTTP / TLS diagnostic**. Kairo displays DNS → TCP → TLS → HTTP separately, including one selected resolved address, layer timings, response status, an unfollowed redirect location, selected safe headers, certificate identity/validity/expiration, hostname validation, and negotiated TLS version. It sends one GET, reads response headers only, and does not crawl, follow redirects, retain a response body, retry, scan, or save diagnostic results.

Real Kairo UI acceptance passed for `https://google.com` through `HTTP_RESPONSE`; `https://expired.badssl.com` correctly stopped at `TLS_CERTIFICATE_EXPIRED`; and `https://wrong.host.badssl.com` correctly stopped at `TLS_CERTIFICATE_HOSTNAME_MISMATCH`. System trust remains enforced. Safe HL7/MLLP diagnostics are the next checkpoint; profiles, baselines, evidence correlation, and Stage Six remain unstarted.

## Current checkpoint — Stage Five safe HL7/MLLP diagnostics

In **Diagnostics → HL7 / MLLP**, enter one authorized host/IP, port, and timeout. **Check safe MLLP reachability** opens and closes one connection without application bytes; expect DNS and TCP evidence followed by `MLLP_NOT_VERIFIED`. **Send one synthetic MLLP test** shows the exact destination and sends one generated synthetic ADT message only after the click. If the receiver returns an ACK, Kairo displays MSA-1, sent MSH-10, returned MSA-2 correlation, MSA text, first ERR detail, and separate application accept/error/reject status. It never reuses imported messages or retries automatically.

Real Kairo UI verification passed through an SSH tunnel at `127.0.0.1:16661` to the controlled CSOL NextGen Connect receiver. Kairo reported `MLLP_MESSAGE_SENT`, `ACK_RECEIVED`, and `APPLICATION_ACCEPT`; MSA-1 was `AA`, and returned MSA-2 exactly matched generated MSH-10 `KAIRO-SYNTH-5E2C87830B1941B5`. Profiles, baselines, evidence correlation, and Stage Six remain unstarted.

## Current checkpoint — Stage Five profiles, baselines, and evidence correlation

Diagnostics now supports local technical endpoint profiles for TCP, DICOM, HTTP, HTTPS, and HL7/MLLP. Selecting a profile fills the existing matching controls but never starts a diagnostic. Create, update, and delete remain explicit; credentials, messages, PHI, URLs in notes, certificates, and unknown fields are rejected by the existing local profile boundary.

After a complete successful diagnostic, the selected matching profile can save an allowlisted local known-good baseline. Loading it compares later matching runs and reports the first changed protocol layer plus meaningful certificate-expiry, ACK, or timing changes without listing unchanged fields. The evidence summary separates observed facts, a qualified likely boundary, missing evidence, and the smallest useful next check using the current diagnostic, baseline comparison, and safe availability signals from existing HL7/DICOM inspection.

Targeted browser-side profile, baseline, correlation, and diagnostics UI tests pass on Linux. The modified JavaScript modules pass syntax checks. Final manual acceptance passed through the real Windows Kairo UI: profile create/select/edit/delete worked; selection populated the existing diagnostic controls without auto-running; a successful DICOM result saved and reloaded as a known-good baseline; a controlled wrong-port rerun changed from `TCP_CONNECTED` to `CONNECTION_REFUSED`; comparison identified TCP as the first changed layer; and the OBSERVED, LIKELY BOUNDARY, MISSING EVIDENCE, and NEXT CHECK guidance remained conservative and evidence-based. Standard-user-only behavior remained intact. Stage Five is complete. Stage Six has not started.
