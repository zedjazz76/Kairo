# Privacy and security boundaries

## Intended use

This is a local analyst tool, not a de-identification certification, clinical decision system, or production interface engine. It makes no HIPAA-compliance or complete Safe Harbor claim. The PHI rule set is conservative but incomplete; human review and organizational approval remain necessary.

Reference: [HHS guidance on de-identification](https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html). Provider preservation is a user-selected policy and can leave identifying context in output.

## Data flow

- Imported originals, raw edits, undo receipts, and replacement dictionaries remain in browser/worker memory.
- Quick Sanitize has no AI, telemetry, analytics, CDN, or remote service dependency. Nothing is automatically sent to chat.
- The local helper receives only sanitized history events, nonclinical destination profiles, and an explicitly reviewed outbound message when sending is requested.
- A send temporarily places original content in helper process memory. Its raw response is returned for immediate inspection but is not written to diagnostic output or the event journal.
- The history API uses a strict field allowlist. Field names such as `rawText`, request bodies, and unknown properties are rejected. A schema is a boundary, not a semantic guarantee: an authorized client can mislabel raw text as sanitized text. The browser sanitizer and review workflow are part of the trusted application.
- Automatic snapshots omit unreviewed narrative and custom-segment fields. Reviewed copy records preserve the output actually authorized, including overrides.
- Runtime history and profiles live under `data/runtime` and are ignored by Git. Do not put operational data in source, test fixtures, notes, issue reports, or profile labels.

## Local access

The helper listens only on IPv4 loopback. Every launch generates a random session token; protected API requests require it. The browser keeps the token in the URL fragment for refresh continuity, not browser storage. Keep the local page URL private and close the page at the end of work.

Responses use no-store headers and a self-only content security policy. API requests with foreign Origins or unexpected Host headers are rejected. Reads, writes, connect attempts, and response collection are bounded. There is no public listener or firewall-rule setup.

Loopback is not protection from malware, another process with the same user's privileges, a compromised browser extension, or an administrator. Do not use this tool on an untrusted workstation.

## Network transmission

Phase 1 provides unencrypted MLLP. It does not implement TLS, certificate verification, VPN setup, or endpoint authentication. Use only approved network paths and authorized destinations. Environment labels are informational and do not enforce network segregation.

A changed message or destination invalidates review. Original-to-Production sending requires another confirmation. Only one message/frame can be attempted per reviewed request. No automatic retry occurs after any send failure. A write can be partial even when its confirmed-byte count is zero; such failures are reported as uncertain delivery.

AA means the matching response reports application acceptance. It is not independent verification of downstream processing. CA is not application acceptance. A mismatched or invalid acknowledgment is not treated as a successful correlated response.

## Persistence, recovery, and deletion

History is written as sanitized newline-completed events, flushed to disk, with an atomic manifest. Text indexes are rebuilt if an interrupted write leaves them inconsistent. A trailing incomplete event is discarded during recovery; complete malformed records cause an error. Recovery does not reconstruct originals.

The application does not encrypt stored history or profiles. Keep the folder out of unapproved synchronization, shared locations, or backups. Apply workstation and organizational protections appropriate for its contents. There is no automatic disk quota or retention purge.

Deleting a session permanently removes its local application files. It is not secure media erasure and cannot remove independent exports, backups, audit products, or clipboard copies. Ending a session clears app state, not OS paging, browser crash recovery, memory snapshots, or monitoring artifacts. Close both the browser and helper.

## Failure handling

Failed history saves block copying and new sends. Retry saves only history, not messages. A failed result save after sending does not undo delivery and must never be used as a reason for automatic retransmission. Review the live result and receiving system.

A stopped sanitizer worker disables protected actions. Unknown coverage and high-risk free text require review. Warning overrides are deliberate exceptions, recorded in sanitized event metadata, not evidence of de-identification.

Do not enter patient data during acceptance testing. Use the synthetic examples and local test receiver. Report bugs with synthetic reproductions, never real messages, patient identifiers, production addresses, credentials, or screenshots containing PHI.
