# HL7 Toolkit Product Design

**Date:** September 3, 2026
**Status:** Approved product direction
**Working title:** HL7 Toolkit
**Primary platform:** Portable Windows application
**Repository:** Private MANA Clinical Systems Wiki repository

## 1. Objective

Build a professional local HL7 v2 analyst and administrator toolkit that:

- requires no installer, compilation step, Windows service, or elevated privileges to build or use;
- accepts pasted messages and files up to 100 MB;
- sanitizes patient PHI for safe review and controlled copying;
- inspects, edits, searches, validates, compares, and reports on HL7 messages;
- sends exactly one edited message at a time to an outbound MLLP endpoint;
- parses and explains the returned ACK or NAK;
- keeps automatic sanitized history while ensuring raw PHI never becomes a local history file; and
- can be developed continuously from the user's work and HP laptops even when the work laptop cannot push to GitHub.

The working title may be changed later without altering the architecture.

## 2. Approved Product Decisions

- Use a portable local web interface with a bundled PowerShell and .NET helper.
- Launch with Open HL7 Toolkit.cmd.
- Bind the application only to 127.0.0.1.
- Use no cloud service, CDN, telemetry, analytics service, or model API.
- Accept logs up to 100 MB and keep the interface responsive through background, progressive processing.
- Keep raw messages only in active process and browser memory.
- Save sanitized message content and activity automatically throughout a session.
- Retain sanitized history until the user deletes individual sessions or performs bulk deletion.
- Preserve provider names by default while sanitizing patient-related identifiers and names.
- Provide Quick Sanitize for content intended to be copied into ChatGPT or another approved research destination.
- Permit a deliberate warning override before copying sanitized content.
- Support outbound MLLP only; do not provide an inbound listener or routing engine.
- Edit and send exactly one message at a time.
- Support production endpoint profiles with stronger confirmations.
- Never retry automatically after uncertain delivery.
- Provide the deepest initial labeling and testing for ADT, ORM/OMI, ORU, SIU, DFT, and ACK while preserving any HL7 v2 message and custom Z-segment generically.
- Use a combined interface: a simple starting surface inside an always-available expert workbench.
- Use explicit high-contrast colors, keyboard access, and readable status labels.

## 3. Product Boundary

HL7 Toolkit is an analyst, de-identification, troubleshooting, documentation, and controlled outbound-testing application. It is not a production interface engine.

It does not:

- receive inbound connections;
- route or transform live feeds unattended;
- schedule or batch-transmit messages;
- retry messages automatically;
- execute user-provided scripts or macros;
- connect directly to interface-engine databases, SFTP sites, or cloud storage in the initial product;
- upload message content to an external service; or
- claim that automated de-identification guarantees zero re-identification risk.

## 4. Architecture

### 4.1 Portable application shell

The application consists of:

- a command-file launcher;
- local HTML, CSS, JavaScript, and definition assets;
- a PowerShell helper using Windows' built-in .NET runtime;
- user-local sanitized history and configuration; and
- synthetic, non-PHI test fixtures.

No package installation or application build is required for normal use. The launcher starts the helper for the current user and opens the default browser to a random-token local session.

### 4.2 Browser workspace

The browser workspace owns:

- file selection and drag-and-drop;
- in-memory raw-message handling;
- progressive parsing through Web Workers;
- Quick Sanitize and residual-risk scanning;
- message list, raw view, tree view, table view, and plain-language view;
- editing, search, comparison, analysis, and validation presentation; and
- explicit clipboard actions.

### 4.3 PowerShell helper

The helper owns:

- the loopback-only HTTP endpoint;
- session-token and origin enforcement;
- atomic writes of sanitized history and safe configuration;
- outbound TCP and MLLP framing;
- ACK collection and transport-level result reporting; and
- safe error codes that never contain message bodies.

The helper holds an outbound message only in memory for the duration of the send operation.

## 5. Workspaces

### 5.1 Home and Quick Sanitize

The Home state offers a drop zone and shortcuts for Quick Sanitize, comparison, inspection, and sending. Quick Sanitize follows:

Paste or drop -> parse -> replace patient PHI -> review -> residual scan -> copy sanitized

The user sees every structured-field replacement and residual warning. If warnings remain, copying requires confirmation that the warnings were reviewed. The sanitized audit record stores warning categories and counts, not suspected raw text.

Stable synthetic identifiers are reused across messages in the active session. The reversible mapping exists only in memory and is destroyed when the session ends.

Safe-for-chat mode removes patient-related calendar dates or converts them to relative markers that preserve sequence without preserving real dates. A separate synthetic-test mode may shift dates consistently but is not labeled Safe Harbor.

### 5.2 Inspect and Edit

The workbench provides raw, tree, table, and plain-language views. It exposes:

- segment, field, component, repetition, and subcomponent paths;
- standard or loaded-definition names;
- delimiters, escape sequences, and timestamps;
- custom and unknown Z-segments without data loss; and
- explicit add, remove, clone, and reorder operations.

No edit is silently applied. Structure-aware changes show the serialized message before replacing the working copy.

### 5.3 Search and Analyze

Search supports:

- text and regular expressions;
- HL7 paths and element descriptions;
- message type, trigger event, time range, and validation state;
- presence, absence, or emptiness of an element;
- duplicate identifiers, message size, and PHI warnings; and
- combined filters.

Analysis adds field population rates, distinct values, min/max lengths, message counts and sizes, throughput, duplicates, outliers, correlations, and suspicious workflow-state transitions.

### 5.4 Compare and Gap Analysis

The product supports:

- exact transport diff, including delimiters, escapes, line endings, encoding, and framing bytes;
- semantic HL7 diff by segment, field, component, repeat, and subcomponent;
- configurable ignore rules for timestamps, control IDs, and selected paths;
- collection-level differences in structure, values, lengths, and field usage; and
- message or collection comparison against a loaded profile.

Messages are never silently paired by position. Pairing is manual or uses an explicit field rule such as MSH-10, ORC-2, OBR-3, accession, or a multi-field key. Ambiguous matches remain unpaired.

### 5.5 Validate and Repair

Validation is layered:

1. Transport and encoding
2. Universal HL7 structure
3. Version and datatype
4. Imported conformance profile
5. Site-specific rule pack
6. Cross-message collection behavior

Every result identifies its source and severity. Missing definitions or profiles are shown as Not evaluated, not as a pass. Site rules are never presented as universal HL7 requirements.

Suggested repairs show before-and-after text and require explicit approval. An analyst may intentionally send an invalid message after acknowledging its findings.

### 5.6 Send and Test

The Send workspace handles exactly one message:

Select one -> edit -> validate -> confirm -> send -> review ACK -> choose next

Before transmission it shows:

- endpoint label, environment, hostname or IP, and port;
- message type and control ID;
- original-in-memory or sanitized content mode;
- encoding and framing;
- outstanding validation or PHI warnings; and
- retry behavior.

Production endpoints are visually distinct. Original-PHI transmission to a production profile requires an extra confirmation. The application never transmits automatically.

ACK handling recognizes AA, AE, AR, CA, CE, and CR; correlates MSA-2 to outbound MSH-10; extracts ERR details; records latency; and distinguishes refusal, timeout, reset, malformed ACK, mismatched control ID, and ambiguous delivery. Ambiguous delivery is never retried automatically.

### 5.7 Transform, Generate, History, and Reports

Later phases add:

- path-aware find and replace;
- value translations and reusable mappings;
- synthetic message templates;
- split, merge, sample, and deduplicate utilities;
- ER7, XML, JSON, and CSV conversion;
- searchable sanitized message libraries;
- validation, comparison, de-identification, and test reports;
- field and code-set inventories;
- mapping matrices and profile-gap reports; and
- interface documentation exports.

Arbitrary executable scripts remain excluded.

## 6. Data Classification and Storage

### 6.1 Volatile raw data

Raw messages may exist only in:

- browser memory;
- Web Worker memory;
- a loopback request body during an explicit outbound send; and
- PowerShell process memory during that send.

Raw data is not written to temporary files, browser storage, application logs, crash-recovery files, Git, or diagnostic output.

### 6.2 Durable sanitized data

Durable data may include:

- sanitized messages and ACKs;
- safe session metadata;
- validation and comparison findings;
- sanitizer rule versions, replacement counts, and warning categories;
- endpoint labels and timings;
- nonsecret profiles and rule packs; and
- generated reports.

Writes are atomic. A crash preserves only the last completed sanitized record. Sending and other audit-required actions are blocked when sanitized history cannot be written.

### 6.3 Retention

Sanitized history remains until manual deletion. The user can delete individual sessions or select multiple sessions for bulk deletion.

## 7. Privacy and Security

- Bind only to the IPv4 loopback address.
- Generate an unpredictable session token on every launch.
- Reject requests with the wrong token or origin.
- Ship every browser asset locally.
- Apply a restrictive Content Security Policy.
- Do not log HTTP bodies, HL7 fields, clipboard content, or raw transport responses.
- Treat imported messages, filenames, profiles, and definitions as untrusted data.
- Escape all displayed values.
- Do not render message-supplied HTML.
- Do not execute macros, formulas, scripts, URLs, or attachments.
- Provide no inbound network listener.
- Keep real endpoint profiles and clinical histories out of Git.

The sanitizer is described as rule-based, Safe Harbor-oriented assistance with a coverage report. It does not make an unconditional compliance claim.

## 8. Large-File Processing

Files up to 100 MB are read progressively. The product:

- detects encoding, segment terminators, message boundaries, batches, MLLP frames, and common log prefixes;
- builds a lightweight in-memory message catalog first;
- calculates deeper indexes and statistics in background chunks;
- exposes progress and cancellation;
- allows already indexed messages to be inspected while parsing continues; and
- keeps the raw working index in memory only.

Saved searches and reports contain sanitized values.

## 9. Error Handling and Recovery

- Parse failures identify a safe message number, segment offset, and error category without writing message content.
- Malformed messages remain inspectable and editable.
- A browser or process crash discards raw working data and restores only completed sanitized history.
- Disk-full or write failures produce a persistent warning and pause audit-required actions.
- Network errors are classified rather than collapsed into a generic failure.
- Cancellation stops before the next processing chunk or outbound action.
- Manual resend repeats the destination and content-mode confirmation.

## 10. User Experience and Accessibility

The application combines:

- a simple Home state and drop zone;
- persistent workspace navigation;
- a message list;
- a central raw, tree, table, and plain-language work area;
- a field-detail panel; and
- a collapsible findings drawer.

Quick Sanitize remains a prominent top-level action. Complexity collapses when it is not needed.

All production, PHI, warning, failure, and unknown states use text and icons in addition to color. Screens use explicit high-contrast foreground and background colors and support keyboard navigation.

## 11. Delivery Roadmap

### Phase 1: Core tool

Portable shell, generic parser, 100 MB message catalog, Quick Sanitize, sanitized history, raw/tree editing, exact and semantic single-message comparison, basic validation, one-at-a-time MLLP sending, and ACK analysis.

### Phase 2: Analyst scale

Advanced views, deep filters, statistics, cross-message analysis, collection comparison, searchable sanitized history, and reports.

### Phase 3: Validation

Version-aware definition packs, deeper message-family coverage, table checks, conformance profiles, site rule packs, Z-segment definitions, collection rules, and safe repair suggestions.

### Phase 4: Professional tooling

Mappings, transformations, synthetic templates, message utilities, format conversion, inventories, profile-gap analysis, and interface documentation.

Each phase receives its own specification, plan, tests, and review.

## 12. Cross-Laptop Continuity

The private Git repository is the source of truth for:

- application source;
- specifications and plans;
- test code;
- synthetic sanitized fixtures;
- legally distributable definition packs; and
- release instructions.

The repository excludes runtime history, real endpoint profiles, machine settings, browser state, credentials, certificates, temporary files, and visual-brainstorming state.

Two handoff routes are supported:

### Route A: Private Git remote

Commit locally and push from a machine permitted to reach the private remote. The HP laptop pulls the same branch and resumes from the checked-in plan.

### Route B: Verified Git bundle

When the work laptop cannot push:

1. Make a focused local commit containing only approved source, documentation, tests, and synthetic fixtures.
2. Create a Git bundle for the HL7 Toolkit branch.
3. Verify the bundle.
4. Record its branch, commit, required base commit, and SHA-256 hash in a README.
5. Transfer the package only through a MANA-approved method.
6. Import the branch on the HP laptop, verify the bundle and hash, and continue locally or push from that machine.

The handoff package must contain no runtime history, real endpoints, PHI, credentials, production data, or certificates. Conversation history alone is not treated as a substitute for transferring repository state.

## 13. Quality Gates

Every phase must pass:

- canary-PHI tests proving raw values do not appear in filesystem output;
- parser preservation tests for delimiters, repetitions, escapes, Unicode, malformed data, and Z-segments;
- sanitizer tests for structured identifiers, free text, dates, stable replacements, provider preservation, and residual warnings;
- MLLP framing, encoding, ACK correlation, timeout, and ambiguous-delivery tests;
- crash, disk-full, history-write, and cancellation tests;
- a 100 MB responsiveness test;
- high-contrast and keyboard-accessibility checks; and
- a clean standard-user Windows launch test with no elevation.

## 14. Research Basis

The feature design was informed by publicly documented capabilities from:

- [7Edit](https://7edit.com/features/)
- [Caristix Workgroup](https://caristix.com/complete-and-specialized-hl7-fhir-solutions/workgroup/)
- [HL7Spy](https://hl7spy.ca/)
- [HAPI TestPanel validation](https://hapifhir.github.io/hapi-hl7v2/hapi-testpanel/validation.html)
- [NIST HL7 v2 conformance testing tools](https://www.nist.gov/itl/health-it-testing-infrastructure/testing-tools/hl7-v2-conformance-testing-tools)
- [HHS de-identification guidance](https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html)
- [Microsoft .NET TCP documentation](https://learn.microsoft.com/en-us/dotnet/fundamentals/networking/sockets/tcp-classes)
