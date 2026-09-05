# KAIRO Guardian — HL7 Toolkit

A portable clinical systems copilot for inspecting, editing, comparing, sanitizing, validating, and deliberately sending one HL7 v2 message at a time.

## Start

1. Keep the `hl7-toolkit` folder in a local folder you can write to.
2. Double-click **Open HL7 Toolkit.cmd**.
3. Keep the helper window open while using the browser page. Use the page opened by the launcher; an old bookmark may contain an expired session key.

There is no application build or installation step. The application uses Windows PowerShell 5.1, built-in Windows networking, and a modern browser. No administrator account, Windows service, firewall exception, registry change, package manager, or cloud account is required by the application. Corporate execution policies may still block scripts; ask your IT team rather than weakening those policies.

The launcher sets the execution policy for its own PowerShell process only. It does not change the machine or user policy. The local web helper listens only on `127.0.0.1` and chooses an available port.

## Work with messages

- **Home:** drop one UTF-8 text file up to 100 MiB (104,857,600 bytes), paste a log, or load the synthetic sample. Processing stays in a background worker. Recognized MLLP framing, batch envelopes, and common log prefixes are separated from selectable messages.
- **Inspect & edit:** select one message. Use the raw editor or a field path such as `PID-5.1`. Apply an edit explicitly. Undo/redo and segment add, clone, move, and remove act on the selected message only. Raw drafts must be applied before sending.
- **Search & filter:** use the quick catalog search for a type or control ID. Open **Advanced filters** to combine metadata conditions or search an HL7 path such as `OBX-5`. Conditions use AND logic. Deep path searches run in the background; clear filters to restore the complete catalog.
- **Compare:** select two messages. Compare semantic field paths or the exact changed character window. Ignore selected fields without modifying either message.
- **Validate:** see basic header, delimiter, timestamp, numeric, escape, duplicate-control-ID, and message-boundary findings. “Not evaluated” is a limitation, not a pass.

Input files are not modified. Original messages and undo history are kept in the browser session, not written to application history.

Filter terms remain in browser and worker memory and are not written to sanitized history. Use **equals** or **contains** for routine searches. Regular expressions use JavaScript syntax without surrounding slashes; an invalid expression leaves the last valid result visible.

## Quick Sanitize for research

1. Open **Quick Sanitize** or **Sanitize selected**.
2. Paste text and choose date handling.
3. Select **Sanitize now**.
4. Read the entire output and every warning. Acknowledge warnings individually or together only after reviewing them.
5. Select **Copy sanitized**.

Patient-field replacements are consistent within a session. Configured provider fields remain unchanged, as requested. Chat preparation removes recognized calendar dates; synthetic-test mode shifts recognized complete dates consistently and is **not** a de-identification determination.

Unstructured prose, custom fields, context, and uncommon identifiers can escape automatic detection. A warning override permits copying the reviewed output; it does not establish that the output is safe to share. Copying never uploads the text. Check your organization's requirements before pasting any output into a chat or research service.

## Send one message

1. Select and finish editing a message in Inspect.
2. Open **Send** and enter a destination label, IP/hostname, port, and environment. Saved profiles stay local.
3. Check the encoding, connection/response timeouts, and framing bytes. Defaults are UTF-8 and MLLP `0B … 1C 0D`. Optional profile notes must contain no PHI or secrets.
4. Optionally choose **Check connection**. This opens and closes TCP without sending HL7; a successful check does not verify an HL7 receiver.
5. Choose the original edited message or a sanitized synthetic-test version.
6. Select **Review and send one message**. Review the exact outgoing text, destination, and warnings, then confirm.

Original content sent to a Production-labeled destination requires a second explicit confirmation. A Test label is only a label; it does not make an endpoint safe. Line endings are normalized to HL7 carriage returns for transmission. Unsupported characters are rejected rather than silently substituted by the chosen encoding. A single message is limited to 8,388,608 characters; the 100 MiB limit applies to an input file/catalog, not one send request.

MLLP is **not encrypted** in Phase 1. Use only authorized destinations over an approved network. There is no inbound clinical listener, bulk-send queue, scheduled replay, automatic retry, or TLS support.

### Understand the result

| Response | Meaning |
|---|---|
| AA | Correlated application acceptance. It is not independent proof of downstream clinical processing. |
| AE / AR | Correlated application error / rejection. Inspect the response details. |
| CA | Commit acceptance; application processing is not confirmed. |
| CE / CR | Commit error / rejection. |
| Wrong control ID | The response does not match the selected message; delivery is uncertain. |
| Timeout, lost response, partial write, malformed response | Delivery may have occurred. Check the receiving system before deciding to send again. |

The toolkit reads the first framed response and shows MSA/ERR details. It does not automatically wait for a separate later application acknowledgment in enhanced acknowledgment workflows. One confirmation produces at most one transmission attempt. Reusing the same request identifier is rejected by the helper.

## Saved history

Sanitized snapshots are saved automatically during import and after applied edits, comparisons you explicitly save, and reviewed copy/send actions. Saving sanitized content immediately avoids relying on browser shutdown to remove PHI from a raw log.

Automatic history omits unreviewed narrative and unknown-segment values. Reviewed clipboard audit entries contain the actual sanitized output you chose to copy, including anything you explicitly overrode. Providers are preserved. Always treat saved history as potentially sensitive.

**History** lets you list, search, open, export, and delete selected sessions. Deletion is permanent in the application and does not erase copies, exports, backups, browser/OS artifacts, or clipboard history.

If saving fails, keep the page open, check free disk space and the helper, then use **Retry history**. Copying and sending stay blocked until pending saves succeed. Retrying history never resends an HL7 message. If an HTTP response was lost after a successful disk write, a retry may create a duplicate history entry.

The newline-completed event journal is authoritative. On reopening, interrupted content indexes are rebuilt from complete sanitized records; an incomplete final journal fragment is discarded. Other journal corruption is reported rather than silently treated as valid history.

## End the session

Finish or cancel intake, wait for sanitized history to finish saving, then choose **End session**. This clears the browser workspace and starts a fresh in-memory session; saved sanitized history remains. Close the browser tab and helper window when finished. Closing only the helper does **not** clear content already displayed in a browser tab.

The application does not guarantee forensic erasure from browser memory, operating-system paging, crash dumps, clipboard history, endpoint monitoring, or backups. See [SECURITY.md](SECURITY.md).

## Current limitations

- Basic validation only: no full version-specific grammar, table, cardinality, clinical-semantic, or local conformance-profile validation.
- The field dictionary is a limited original label set, not a licensed comprehensive HL7 dictionary.
- UTF-8 file intake; outbound encodings include UTF-8, ASCII, Windows-1252, and ISO-8859-1.
- Exact comparison shows a minimal changed character window, not a source-encoding byte diff.
- Advanced filters use AND logic only. Saved searches, OR groups, fuzzy matching, and result export are not included yet.
- History is not encrypted by the application and has no automatic retention limit.
- Browser visual/keyboard acceptance and double-click launch checks are recorded separately in [VERIFICATION.md](VERIFICATION.md). Automated tests do not replace those checks.

## Development checks

No build is needed to change or use the app. With Node.js 24 available, run from the repository root:

```powershell
node --test --test-isolation=none tests/hl7-toolkit/*.test.mjs
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/hl7-toolkit/helpers/service-probe.ps1
```

Tests use generated synthetic values, disposable local folders, and loopback-only test receivers. They never connect to a clinical endpoint. The optional one-message synthetic receiver is `tests/hl7-toolkit/helpers/mllp-stub.ps1`; do not use it with patient data.
