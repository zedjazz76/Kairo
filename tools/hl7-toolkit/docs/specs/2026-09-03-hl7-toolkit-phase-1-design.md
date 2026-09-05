# HL7 Toolkit Phase 1 Design

**Date:** September 3, 2026
**Status:** Approved for Phase 1 implementation
**Parent design:** docs/superpowers/specs/2026-09-03-hl7-toolkit-product-design.md
**Phase goal:** Deliver the first portable, safe, useful sanitize–compare–edit–send release.

## 1. Phase 1 Outcome

A Windows user can copy the portable folder, double-click the launcher, and, without installation or elevated privileges:

1. paste HL7 v2 messages or open a file up to 100 MB;
2. browse the progressively built message catalog;
3. inspect and edit one message;
4. create and review a patient-PHI-sanitized version;
5. copy the sanitized message for research;
6. compare two messages exactly or semantically;
7. run basic structural preflight checks;
8. send exactly one reviewed message to an outbound MLLP endpoint; and
9. inspect the correlated ACK or NAK.

Sanitized session history is saved automatically. Raw content is never saved.

## 2. Scope

### Included

- One-click portable launcher
- Loopback-only helper and random session token
- Responsive file and paste intake
- Files up to 100 MB
- Generic HL7 v2 ER7 parsing
- Unknown messages and Z-segment preservation
- Message catalog with message number, MSH-7, MSH-9, MSH-10, and MSH-12 when present
- Raw and tree inspection
- One-message structure-aware editing
- Quick Sanitize
- Provider preservation
- Safe-for-chat and synthetic-test date behavior
- Residual warnings and deliberate clipboard override
- Exact and semantic two-message comparison
- Basic validation
- MLLP connection check
- Exactly one outbound message per user confirmation
- ACK and NAK classification and correlation
- Atomic sanitized session history
- Individual and bulk history deletion
- High-contrast, keyboard-accessible combined workbench
- Synthetic fixtures for ADT, ORM/OMI, ORU, SIU, DFT, ACK, and Z-segments

### Excluded

- Inbound listening
- Batch sending, queues, replay, pacing, and scheduling
- Automatic retries
- Advanced collection statistics
- Batch-to-batch comparison
- Full standard or profile conformance validation
- Site rule-pack authoring
- Transformation pipelines and format conversion
- Interface-engine, database, SFTP, or cloud connectors
- Executable user scripts

## 3. Portable Layout

The implementation uses these logical boundaries:

~~~text
hl7-toolkit/
  Open HL7 Toolkit.cmd
  app/
    index.html
    styles/
    scripts/
    workers/
    definitions/
  service/
    Start-HL7Toolkit.ps1
    HL7Toolkit.Http.psm1
    HL7Toolkit.History.psm1
    HL7Toolkit.Mllp.psm1
    HL7Toolkit.Security.psm1
  tests/
    browser/
    powershell/
    fixtures/synthetic/
  data/
    history/
    profiles/
    rules/
~~~

The repository ignores hl7-toolkit/data except for a nonclinical README. Synthetic fixtures are stored under tests/fixtures/synthetic.

## 4. Launch and Local Security

Open HL7 Toolkit.cmd:

1. resolves its own directory;
2. starts Windows PowerShell with an execution-policy override limited to that process;
3. generates a cryptographically random session token;
4. selects an available high loopback port;
5. starts the helper on 127.0.0.1 only; and
6. opens the default browser with the full tokenized URL.

The helper:

- rejects nonloopback connections;
- requires the session token for every application and API request;
- accepts only the local application origin;
- serves only allowlisted static files;
- applies security headers and a restrictive Content Security Policy;
- redacts request bodies and message content from errors; and
- stops after the application closes or the idle timeout.

No URL prefix registration, service installation, firewall exception, or registry change is allowed.

## 5. Intake and 100 MB Processing

The browser reads selected files directly through the File API. Files are not uploaded to the helper for parsing.

The intake worker:

- rejects files above 100 MB before reading;
- detects supported encodings and byte-order marks;
- preserves representation needed for exact comparison;
- detects CR, LF, and CRLF segment boundaries;
- recognizes common MLLP framing;
- recognizes FHS and BHS batches;
- locates MSH boundaries;
- identifies common non-HL7 prefixes as warnings instead of silently discarding them; and
- reports truncated or ambiguous boundaries.

The progressive catalog initially stores:

- ordinal and source offsets;
- detected message boundaries;
- MSH-7, MSH-9, MSH-10, and MSH-12 when parseable;
- segment count;
- parse-warning count; and
- estimated message size.

The user can open indexed messages while later chunks continue. Cancellation takes effect before the next chunk. No raw index or raw message is persisted.

## 6. Generic HL7 Parser

The parser:

- finds the field separator from MSH-1;
- reads component, repetition, escape, and subcomponent delimiters from MSH-2;
- preserves empty elements and trailing separators;
- preserves repetitions and subcomponents;
- treats segment names generically;
- preserves unrecognized segments and Z-segments;
- represents each value by a stable path;
- records source offsets for exact highlighting; and
- serializes only explicitly edited structure.

The parser does not reject a message solely because its version, type, or segment is unknown. It reports the coverage limitation.

Round-tripping an unedited message must preserve its content exactly.

## 7. Quick Sanitize

### 7.1 Processing order

1. Parse structured elements.
2. Extract known patient identifiers and names into an in-memory session dictionary.
3. Replace configured structured patient elements.
4. Replace occurrences of known patient values in free-text elements.
5. Scan all remaining values for high-risk patterns.
6. Present replacements and residual warnings.
7. Run the residual scan again immediately before copying or saving.

Provider elements remain unchanged by default. A value in a patient-identity field is sanitized even if its text resembles a provider.

### 7.2 Covered PHI categories

The initial rules cover:

- patient and related-person names;
- medical record, account, encounter, order, accession, insurance, and beneficiary identifiers when configured as patient-linked;
- Social Security and comparable national identifiers;
- addresses and geographic subdivisions below state level;
- phone and fax numbers;
- email addresses;
- birth, admission, discharge, procedure, observation, and other patient-related dates;
- URLs and IP addresses found in patient or narrative content;
- device, certificate, license, vehicle, and biometric identifiers represented as text; and
- other configured unique patient-linked codes.

The coverage report lists every evaluated category and rule version.

### 7.3 Stable replacements

The in-memory session dictionary produces stable synthetic values such as:

- PATIENT^ALPHA
- MRN-0001
- ACCOUNT-0001
- ENCOUNTER-0001
- ORDER-0001
- ACCESSION-0001

The dictionary is never serialized. Sanitized history retains only replacements.

### 7.4 Date modes

Safe-for-chat mode removes patient-related dates or replaces them with relative markers while preserving sequence and intervals where possible.

Synthetic-test mode uses a consistent session-only shift and clearly states that the result is synthetic test data, not a Safe Harbor determination.

### 7.5 Clipboard action

The application never copies automatically. Copy sanitized:

1. reruns the residual scan;
2. displays unresolved warnings;
3. requires acknowledgement when warnings remain;
4. writes the sanitized audit event; and
5. places only sanitized text on the clipboard.

If the audit record cannot be written, the copy action pauses and explains the storage failure.

## 8. Inspect and Edit

Phase 1 contains:

- message catalog;
- raw view;
- expandable segment, field, repetition, component, and subcomponent tree;
- path and detected-description panel;
- editable value control;
- add, remove, clone, and reorder segment actions;
- delimiter and escape visibility; and
- undo and redo for the active in-memory message.

Likely PHI and validation findings are marked without altering the message.

## 9. Compare

Phase 1 compares exactly two explicitly selected messages.

Exact mode identifies character, separator, escape, segment-terminator, leading-content, trailing-content, framing, and known encoding differences.

Semantic mode aligns segment occurrence, field, repetition, component, and subcomponent. It reports added, removed, and changed paths.

The user may ignore selected paths, timestamps, and control IDs. Ignore rules affect presentation only and never rewrite content. Phase 1 does not auto-pair collections.

## 10. Basic Validation

Phase 1 preflight checks:

- missing or malformed MSH;
- invalid or duplicated encoding characters;
- unparseable delimiters or escapes;
- missing MSH-9, MSH-10, or MSH-12;
- malformed segment identifiers;
- invalid basic timestamp or numeric syntax in recognized elements;
- duplicate MSH-10 values within the loaded catalog;
- inconsistent declared version within one message; and
- truncated MLLP or message boundaries.

Findings are Error, Warning, Information, or Not Evaluated. A user may intentionally send a message with findings after explicit acknowledgement.

Deep version structures, tables, site constraints, and conformance profiles are Phase 3.

## 11. MLLP Connection Profiles

A profile contains:

- user-facing label;
- Test or Production classification;
- hostname or IP address;
- TCP port;
- connect and response timeouts;
- selected character encoding;
- MLLP start and end bytes; and
- optional notes without clinical content.

Profiles contain no credentials or message content. Real profiles remain in ignored local runtime data and are not committed to Git.

A connection check resolves the host and opens then closes TCP without sending HL7. The interface states that a remote system may still record the attempt.

## 12. One-at-a-Time Send

Only one message can enter Send at a time.

Before enabling Send, the application displays:

- endpoint and environment;
- hostname or IP and port;
- message type;
- MSH-10 or a warning that it is absent;
- original or sanitized content mode;
- encoding and framing;
- validation findings; and
- PHI warnings.

Production profiles use an unmistakable banner. Sending original in-memory content to Production requires an additional confirmation naming the destination and stating that the message may contain PHI.

The helper:

1. validates the request token and endpoint profile;
2. opens outbound TCP;
3. encodes the message using the selected character encoding;
4. writes one MLLP frame;
5. waits for one framed response until timeout;
6. returns response bytes and safe transport metadata to the browser; and
7. removes request and response references after completion.

There is no automatic retry. Manual resend repeats the full review and confirmation.

## 13. ACK Analysis

The ACK analyzer:

- parses MSH, MSA, and ERR when present;
- recognizes AA, AE, AR, CA, CE, and CR;
- compares MSA-2 with outbound MSH-10;
- shows human-readable acceptance or rejection;
- identifies reported error location and severity;
- measures connect and response timing;
- distinguishes empty, malformed, unframed, partial, and unrelated responses; and
- marks delivery Unknown if bytes may have been sent but no conclusive response arrived.

Sanitized request and response content, safe endpoint label, result category, timings, and warning counts enter history.

## 14. Sanitized History

Each session directory contains:

- manifest.json for safe session metadata and status;
- messages.hl7 for sanitized user-visible content;
- events.jsonl for sanitized actions and safe outcomes; and
- reports for explicitly generated sanitized reports.

Atomic replacement prevents a partially written manifest. Events are appended only after their payload passes the history boundary.

History supports chronological listing, search over sanitized content, open, export, individual deletion, bulk deletion, and storage-size display.

Deletion displays the exact session count and requires confirmation.

## 15. Error Handling

- Invalid input remains inspectable when a safe boundary can be established.
- Parser exceptions produce safe error codes and source positions.
- Already indexed messages remain available if later chunks fail.
- Closing the browser or helper destroys raw working state.
- A history-write failure blocks copy and send actions requiring an audit event.
- TCP refusal, DNS failure, timeout, reset, malformed response, negative ACK, mismatched ACK, and ambiguous delivery are distinct.
- Cancel stops parsing before the next chunk and stops sending only before transmission begins.

## 16. User Interface

Phase 1 uses the approved combined layout:

- persistent left navigation;
- simple Home drop zone and task shortcuts;
- prominent Quick Sanitize;
- message list;
- central raw and tree work area;
- right-side field detail;
- collapsible findings drawer; and
- clear Local, Test, Production, PHI, Warning, and Unknown badges.

All text uses explicit high-contrast foreground and background pairs. Status is never communicated by color alone.

## 17. Cross-Laptop Development and Restricted Git Push

Tracked in the private repository:

- Phase 1 source;
- tests;
- synthetic fixtures;
- specification and implementation plan;
- safe definition data with documented licensing; and
- developer and release instructions.

Ignored:

- hl7-toolkit/data;
- raw or sanitized working histories;
- endpoint profiles;
- local browser state;
- certificates and secrets;
- temporary files; and
- visual-companion state.

If the work laptop cannot push, every handoff uses a focused local commit plus a verified Git bundle. The bundle package includes:

- the HL7 Toolkit branch only;
- a README naming the branch, bundle commit, required base commit, and continuation step;
- a SHA-256 hash; and
- verification instructions.

It contains no runtime message history, real endpoint profiles, PHI, credentials, production data, or certificates. It may be moved only through a MANA-approved method.

The HP laptop verifies and imports the bundle, then continues from the checked-in implementation plan. It may push to the private remote if that machine is allowed.

## 18. Testing

### Parser

- Standard and custom delimiters
- Empty and trailing elements
- Repeats, components, and subcomponents
- Escapes and Unicode
- CR, LF, and CRLF
- MLLP, FHS/BHS, prefixes, truncation, and malformed boundaries
- Unknown messages and Z-segments
- Exact unedited round trip

### Sanitizer

- Every configured PHI category
- Patient values repeated in structured fields and free text
- Provider preservation
- Stable session replacements
- Both date modes
- Warning generation and override
- Residual scan before clipboard
- No reversible mapping in saved output

### Privacy canaries

Each test uses unique raw canary values. After paste, parse, sanitize, compare, send, error, cancel, simulated crash, and end-session flows, tests inspect the temporary runtime directory and fail if any raw canary appears.

### Compare and edit

- Exact and semantic changes
- Repeats and duplicate segments
- Ignore rules
- Add, remove, and reorder
- Undo and redo
- Untouched-content preservation

### MLLP

- Default and custom framing
- Multiple encodings
- AA, AE, AR, CA, CE, and CR
- ERR details
- Control-ID match and mismatch
- Refusal, timeout, reset, malformed response, and ambiguous delivery
- No automatic retry
- Exactly one outbound frame per confirmation

### Portability and experience

- Launch from a path containing spaces
- Move the entire folder and relaunch
- Standard Windows user with no elevation
- No firewall or registry modification
- 100 MB load, progress, interaction, and cancellation
- Keyboard navigation
- High-contrast review
- Browser refresh and helper restart

## 19. Acceptance Criteria

- A standard Windows user launches without installation or elevation.
- No compilation command is required to use the delivered folder.
- A 100 MB synthetic log is accepted, progressively cataloged, and cancellable without making the interface unusable.
- An unedited message round-trips exactly.
- Quick Sanitize replaces configured patient identifiers consistently, preserves configured provider elements, and reports residual warnings.
- Copy places only the reviewed sanitized result on the clipboard.
- Privacy-canary tests find no raw value in runtime filesystem output.
- Exactly two explicitly selected messages can be compared in exact and semantic modes.
- Exactly one reviewed message is sent per confirmation.
- Production and original-PHI sends require the approved extra confirmation.
- The returned ACK is classified, correlated, timed, and saved only in sanitized form.
- No failed or ambiguous send is retried automatically.
- Sanitized history survives restart and supports individual and bulk deletion.
- The application makes no external connection except the user-selected MLLP endpoint.
- The source, specification, tests, and synthetic fixtures can be continued from the HP laptop by private Git or a verified PHI-free bundle.
