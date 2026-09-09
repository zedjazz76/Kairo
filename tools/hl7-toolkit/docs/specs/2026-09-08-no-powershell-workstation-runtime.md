# Kairo HL7 Toolkit v0.7.3 — No-PowerShell Workstation Runtime

**Status:** Implemented and manually accepted — Workstation Runtime Build 1
**Classification:** Architectural / Release Engineering
**Source checkpoint:** `714e5c9d24a471f0c39e95e65441d2416e65ad53`
**Target:** Windows x64 workstation runtime
**Scope:** Runtime and packaging migration only; feature development remains paused

**Release identity:** Kairo HL7 Toolkit v0.7.3 — Workstation Runtime Build 1

## 1. Objective

Replace Kairo's PowerShell-based workstation helper with a self-contained Windows x64 executable. A standard user must be able to copy or extract the versioned folder and double-click the executable to start Kairo under an effective Windows PowerShell execution policy of `Restricted`.

The workstation runtime must not execute PowerShell scripts or modules and must not require Administrator rights, elevation, an installer, WSL, Git, Codex, Node.js, Python, Java, or a separately installed .NET runtime.

The migration preserves the accepted Kairo v0.7.3 browser application, local API contract, protocol behavior, session model, persistence/privacy boundaries, and feature set. It does not begin Checkpoint 7.4.

## 2. Current Runtime Inventory

### 2.1 Launch chain

The current chain is:

1. `Open HL7 Toolkit.cmd`
2. `powershell.exe`
3. `service/Start-HL7Toolkit.ps1`
4. imported `HL7Toolkit.*.psm1` modules
5. C# source compiled at runtime with PowerShell `Add-Type`
6. default browser opened to an authenticated loopback URL

This chain cannot run when effective Windows PowerShell policy is `Restricted`. Kairo does not require bypass semantics; the bypass exists only to permit the current script-based host to start.

### 2.2 PowerShell responsibilities

| Current file | Runtime responsibility to preserve |
|---|---|
| `Start-HL7Toolkit.ps1` | Resolve application/data paths, create a session token, create the data root, start the helper on an OS-selected port, report the local URL, and launch the default browser. |
| `HL7Toolkit.Security.psm1` | Cryptographic token generation and comparison, loopback/host validation, safe static-path resolution, and response security headers. |
| `HL7Toolkit.Paths.psm1` | Data-root containment and reparse/link traversal rejection. |
| `HL7Toolkit.History.psm1` | Sanitized history schema validation, atomic/append writes, index reconciliation, list/read/delete operations, and session paths. |
| `HL7Toolkit.Profiles.psm1` | Endpoint-profile and diagnostic-baseline validation, constrained paths, save/list/read/delete operations. |
| `HL7Toolkit.Mllp.psm1` | HL7 encoding, MLLP framing, bounded TCP connection and frame I/O, reachability check, and reviewed one-message send. |
| `HL7Toolkit.Diagnostics.psm1` | Request validation/mapping and dispatch to existing C# endpoint and HTTP/TLS diagnostics. |
| `HL7Toolkit.Mwl.psm1` | Strict MWL request validation/mapping and dispatch to the existing C# MWL client. |
| `HL7Toolkit.StudyQuery.psm1` | Strict Study Root request validation/mapping and dispatch to the existing C# Study Query client. |
| `HL7Toolkit.Http.psm1` | Bounded HTTP parsing, authentication/origin/host enforcement, route dispatch, reviewed-send idempotency, static-file delivery, security headers, and the loopback listener. |

The local HTTP API currently includes session, endpoint diagnostic, MWL, Study Root, profile, baseline, MLLP, and sanitized-history routes. The replacement must retain their accepted methods, paths, request limits, validation outcomes, response status codes, JSON field names, and security headers.

### 2.3 Existing C# responsibilities

The protocol-heavy implementations already exist in:

- `EndpointDiagnostics.cs`: DNS, TCP, DICOM association/C-ECHO, and the accepted endpoint diagnostic evidence model.
- `HttpTlsDiagnostics.cs`: DNS, TCP, TLS, and HTTP diagnostics.
- `DicomQueryDiagnostics.cs`: the shared bounded C-FIND core, MWL adapter, Study Root adapter, status classification, character-set handling, response limits, and C-CANCEL behavior.

These sources will be compiled into the executable at build time. The workstation will not receive C# source for runtime compilation and will not invoke `Add-Type`.

### 2.4 Browser responsibilities

The accepted HTML, CSS, JavaScript modules, workers, definitions, navigation, inspectors, comparison workflow, and UI state remain external static assets under `app/` and `definitions/`. They continue to call the same authenticated loopback API. No browser feature is reimplemented in the helper.

## 3. Architectural Approaches

### 3.1 Recommended: self-contained .NET folder publish

Create a small .NET console host targeting Windows x64 and publish it self-contained with `PublishSingleFile=false`. The executable hosts the existing API, incorporates the existing C# protocol code at build time, and uses narrowly separated C# services for the PowerShell responsibilities listed above.

Advantages:

- no workstation runtime installation or PowerShell execution;
- transparent and auditable file inventory;
- no single-file extraction behavior or temporary native-library materialization;
- easier diagnosis, allowlisting, deterministic release manifests, and rollback;
- lowest migration risk for the existing managed C# code.

Costs:

- more files and a larger package than a framework-dependent build;
- the full published folder must remain intact;
- the development environment needs a pinned .NET SDK to build releases.

### 3.2 Alternative: self-contained single-file publish

Publish one large executable and retain the browser assets beside it. This shortens the managed file list but makes binary inspection and partial repair harder, can introduce extraction or native-loading differences, and may attract more antivirus/reputation scrutiny. It provides no meaningful user benefit because Kairo already requires external browser assets and definitions.

This is not selected for the initial runtime.

### 3.3 Alternative: NativeAOT executable

Compile the helper with NativeAOT. This could reduce runtime framework files, but it adds compatibility and maintenance risk around serialization, reflection, globalization, encodings, TLS, and the existing protocol model. It would widen the migration beyond the release blocker without improving accepted product behavior.

This is out of scope.

## 4. Approved Architecture

### 4.1 Runtime shape

The workstation package contains one self-contained .NET Windows x64 folder publish plus the existing browser assets and approved clean data layout:

```text
Kairo-HL7-Toolkit-v0.7.3/
  Kairo.Helper.exe
  [self-contained .NET runtime files]
  app/
    definitions/
  data/
    runtime/
  VERSION.txt
  README-RUN.txt
  RELEASE-NOTES.md
  RELEASE-MANIFEST.json
```

`Kairo.Helper.exe` is the launcher. No `.cmd`, `.ps1`, or `.psm1` file is required or included. Avoiding a wrapper removes an unnecessary process and guarantees that successful startup does not depend on command-script policy.

Definitions remain under `app/definitions/`, matching the accepted static URL root and browser asset layout. They are not moved to an independently served filesystem root.

The executable manifest uses the ordinary non-elevating `asInvoker` execution level. It does not install, register, or persist itself.

### 4.2 Publish model

The release is produced on the development laptop using a pinned supported .NET SDK and:

```text
Configuration: Release
Runtime identifier: win-x64
Self-contained: true
Single-file: false
NativeAOT: false
```

The implementation plan must pin the SDK and target framework before code work begins. The current development environment does not have a .NET SDK installed; obtaining that development-only build prerequisite is separate from the workstation runtime and must not introduce a workstation dependency.

### 4.3 Component boundaries

The executable is divided into focused internal components:

- **Bootstrap:** resolves paths relative to the executable, creates the cryptographic session token, starts the listener, prints non-PHI status, launches the default browser, and owns shutdown.
- **Loopback HTTP host:** preserves bounded request parsing, authentication, static serving, route dispatch, response security headers, and request/response limits.
- **Security and path services:** preserve token validation, host/origin/remote-address rules, static traversal protection, data-root containment, and reparse-point protection.
- **Profile/baseline/history repositories:** preserve the existing file formats, validation, atomicity, and PHI-safe schemas.
- **Reviewed-send and MLLP services:** preserve idempotency, encoding, framing, connection limits, ACK handling, and explicit-only transmission.
- **Diagnostic adapters:** validate existing request DTOs and call the compiled endpoint and HTTP/TLS diagnostic code.
- **DICOM query adapters:** validate existing MWL and Study Root DTOs and call the compiled shared C-FIND implementation without changing its accepted behavior.

No component may call PowerShell or dynamically compile source.

### 4.4 .NET project architecture

The source project is a Windows-targeted console executable whose assembly output is `Kairo.Helper.exe`. It references the accepted C# diagnostic/query source at compile time and adds ordinary C# implementation units for bootstrap, HTTP, security/path rules, repositories, MLLP, and typed route adapters. Project boundaries must allow each unit to be tested without starting the browser or performing unintended network traffic.

The project uses only libraries supplied by the selected self-contained .NET runtime unless an additional dependency is demonstrably necessary and separately reviewed for licensing, release inventory, and security. It must not host PowerShell, use `System.Management.Automation`, shell out to `powershell.exe`/`pwsh.exe`, compile C# dynamically, or download components at startup.

Build output is never served as static content. Only the allowlisted browser root is reachable through static-file routing.

### 4.5 HTTP hosting choice

Use a direct managed `TcpListener` bound to `IPAddress.Loopback` with port `0`, preserving the accepted host's explicit HTTP parsing and avoiding URL ACL registration. Do not migrate to an externally visible web server, Windows service, or framework that requires machine registration.

The listener must:

- bind exactly to `127.0.0.1`;
- accept the OS-selected ephemeral port;
- reject non-loopback remote addresses;
- enforce the accepted `Host`, `Origin`, and session-token rules;
- retain the existing header/body/route-specific limits and timeouts;
- close connections according to the existing request model;
- never add a firewall rule.

IPv6, LAN binding, network discovery, background polling, and automatic endpoint probing are not added.

### 4.6 Static browser assets

The accepted `app/` tree is copied without product changes and is the sole static root. `/` resolves to the accepted application entry point, and existing relative URLs—including `/definitions/...`, scripts, styles, workers, and local visual assets—retain their behavior and MIME types. Canonical-path containment is checked before every static response; URL decoding, traversal segments, rooted paths, alternate separators, and linked/reparse escapes must not leave `app/`.

Static responses preserve the accepted security and cache headers. API paths cannot fall through to static-file serving, and filesystem error details or developer paths are not returned to the browser.

### 4.7 Browser launch and process lifecycle

After the listener is ready, the executable constructs the existing authenticated URL and opens it with the normal Windows shell/default browser association. Failure to open the browser does not weaken authentication; the console displays the non-token base address and a concise local startup error without logging secrets or PHI.

The helper remains the foreground owner of the listener. Closing it or ending the process stops further service access. Existing browser memory may remain visible until Clear, End Session, reload, or tab/window closure; the executable must not claim that helper closure erases an independently open browser tab.

No service, scheduled task, startup entry, registry key, hidden monitor, or helper-to-browser shutdown mechanism is created.

Shutdown caused by console close, Ctrl+C, or normal process termination stops accepting new requests and disposes listener/network resources. Graceful shutdown must not create a new disk snapshot of patient-bearing browser or query state. Abrupt termination relies on normal operating-system handle cleanup and does not require a recovery service.

## 5. API and Behavioral Compatibility

### 5.1 Contract preservation

The browser must operate without feature-specific changes. For every existing route, the new host preserves:

- route and HTTP method;
- authentication and rejection behavior;
- request size and timeout bounds;
- required, optional, and rejected fields;
- validation ordering where externally observable;
- HTTP status code;
- JSON property name, value type, null/absence behavior, and classification string;
- response security headers;
- reviewed-send idempotency behavior;
- no-cache behavior for sensitive responses.

Golden contract tests compare the PowerShell host and executable during development using synthetic, non-PHI inputs. The PowerShell implementation may remain in source as a migration reference until executable acceptance, but it is excluded from the workstation package and never executed there.

### 5.2 Functional preservation

The executable preserves all accepted functionality through Checkpoint 7.3:

- Home and global session controls;
- HL7 and DICOM inspection browser support;
- endpoint profiles and diagnostic baselines;
- DNS/TCP/DICOM C-ECHO diagnostics;
- HTTP/TLS diagnostics;
- MLLP reachability and reviewed one-message send;
- MWL C-FIND;
- Study Root C-FIND;
- cases, sanitized history, and accepted evidence behavior;
- ORM/MWL comparison;
- selector/navigation UI and Quick Sanitize.

This migration does not alter protocol engines, matching, normalization, result limits, query criteria, UI navigation, persistence formats, or privacy projections.

### 5.3 Encoding and serialization

The executable must explicitly support the same accepted encodings, including required legacy code pages, rather than relying on Windows PowerShell defaults. JSON serialization is configured or modeled so the browser-visible shape matches the existing contract exactly. Culture-sensitive parsing or formatting must use the existing invariant/ordinal semantics.

## 6. Data, Privacy, and Security

### 6.1 Application data

The default data root remains `data/runtime` beneath the extracted release directory. The package ships with an empty approved runtime layout; it contains no profiles, baselines, cases, history, logs, credentials, certificates, private keys, endpoint values, or patient-bearing data.

The data directory must be writable by the standard user who extracted the package. Running from a protected machine-wide directory such as `Program Files` is unsupported unless the user already has a writable approved data location; the helper must fail clearly rather than request elevation.

Existing application persistence remains limited to the already approved profile, baseline, and sanitized-history schemas. The prohibition on “creating persistence” means the executable creates no operating-system persistence mechanism such as a service, scheduled task, startup entry, or registry autorun. It does not remove approved application-data behavior.

The runtime path contract is:

| Data | Location/ownership |
|---|---|
| Endpoint profiles | `data/runtime/profiles/`; existing validated schema and filenames only. |
| Diagnostic baselines | `data/runtime/diagnostic-baselines/`; existing validated PHI-safe schema only. |
| Sanitized history | Existing history session/index paths below `data/runtime/`; exact current schema and atomic-write behavior are preserved. |
| Troubleshooting cases | Browser session memory only in the accepted v0.7.3 workflow; no `cases/` disk directory is introduced. |
| Raw HL7/DICOM content, MWL results, Study Root results, ORM/MWL comparison | Session memory only under their existing lifecycle rules; no disk path is created. |

Directories are created lazily only for an approved operation that currently needs them. A clean release starts with no user records. Existing files outside the approved data root are never imported, searched, or migrated automatically.

### 6.2 PHI boundaries

The migration preserves all accepted privacy rules:

- raw messages and patient-bearing DICOM query results remain in active browser/helper memory only where already approved;
- Q/R and MWL result datasets are not written to disk;
- no PHI-bearing values or raw datasets are written to console, debug output, logs, telemetry, URLs, crash files, or release artifacts;
- profiles, baselines, history, cases, and handoffs retain their existing PHI-safe projections;
- Clear Results and End Session preserve their accepted state-disposal behavior.

The helper produces no disk log by default. Error reporting uses bounded classifications and safe protocol metadata only.

### 6.3 Network behavior

There is no background network traffic. Outbound traffic occurs only after an explicit user action for an explicitly supplied endpoint:

- endpoint diagnostics: DNS, TCP, and the chosen DICOM/MLLP operation;
- HTTP/TLS diagnostics: DNS, TCP, TLS, and HTTP;
- MLLP check or reviewed send;
- MWL C-FIND;
- Study Root C-FIND.

Kairo does not scan, discover, broaden, retry automatically, or listen on a LAN address. Static browsing and browser/helper API traffic remain on loopback.

### 6.4 Workstation controls

The runtime must not:

- request or detect elevation as a startup strategy;
- invoke `runas`;
- call PowerShell;
- alter execution policy;
- write registry settings;
- create firewall rules;
- install certificates or services;
- create scheduled tasks or autorun entries;
- install or download dependencies;
- bind to `0.0.0.0`, a LAN address, or a non-loopback interface.

## 7. Distribution and Trust Boundary

Self-contained publishing removes the PowerShell execution-policy blocker and the separately installed .NET dependency. It does not create publisher reputation or code signing.

For this initial private/internal release, the executable may be unsigned. An Internet-downloaded ZIP or executable may carry Mark of the Web and Windows may display SmartScreen or enterprise application-control warnings. Kairo must not suppress or bypass those controls. Transfer through an organization-approved internal channel that preserves the organization's trust policy is the supported initial distribution model.

Trusted Authenticode signing is recommended as a separate future release-engineering improvement. Certificate procurement, installation, signing infrastructure, reputation management, and policy changes are outside this specification.

## 8. Release Construction and Audit

A repeatable development-only release script should:

1. verify the source commit and clean intended inputs;
2. build and publish the executable for `win-x64` as a self-contained folder;
3. copy only the publish output, accepted `app/` assets, definitions, empty runtime-data structure, and release documents;
4. exclude PowerShell, command scripts, source code, tests, fixtures, synthetic peers, documentation plans/specs, development tooling, repository metadata, credentials, certificates, logs, and runtime data;
5. generate a file-by-file manifest with hashes and a ZIP SHA-256;
6. reject unexpected files, absolute developer paths, known synthetic/PHI canaries, and unsafe archives.

The existing untracked `tools/hl7-toolkit/hl7-toolkit.zip` and `tools/hl7-toolkit/hl7-toolkit/service.zip` are not referenced by the launcher or runtime and are not release dependencies. They are stray/generated development artifacts. They must remain untouched during design and must never be copied into the workstation package.

### 8.1 Version and build identity

The clinical/product feature version remains `0.7.3`. This runtime migration must not advertise itself as `0.7.4` or imply new product functionality. Its release documents record:

```text
Product: Kairo HL7 Toolkit
Version: 0.7.3
Runtime Build: 1
Release Type: Workstation Runtime
Source Commit: 714e5c9d24a471f0c39e95e65441d2416e65ad53
Runtime Identifier: win-x64
Publish Model: Self-contained folder
```

The executable's file/product metadata uses the same product version and identifies Workstation Runtime Build 1 without changing the browser-visible feature version.

### 8.2 Packaging and versioning workflow

The repeatable workflow is:

1. start from the accepted source commit plus the separately approved runtime-migration commit;
2. require an explicit clean input allowlist and refuse unrelated tracked/untracked release inputs;
3. run all migration and non-regression verification before publishing;
4. publish `Kairo.Helper.exe` self-contained for `win-x64` into a clean temporary staging directory;
5. assemble `Kairo-HL7-Toolkit-v0.7.3/` from publish output, accepted browser assets, an empty data layout, and generated release documents;
6. audit the staged folder for forbidden files, secrets, PHI canaries, absolute paths, and unexpected network/runtime dependencies;
7. generate `RELEASE-MANIFEST.json` with release identity, source/runtime-migration commits, relative paths, sizes, and SHA-256 hashes;
8. create `Kairo-HL7-Toolkit-v0.7.3.zip`, verify a clean extraction, and generate `Kairo-HL7-Toolkit-v0.7.3.zip.sha256`;
9. run packaged Windows acceptance from the extracted copy, not from the repository or publish directory;
10. leave generated release artifacts uncommitted unless an explicit release-artifact policy later authorizes otherwise.

Rebuilding Workstation Runtime Build 1 from different source is prohibited. Any changed runtime code or packaged content after acceptance increments the runtime build identity while the feature version remains `0.7.3`, unless a later product checkpoint explicitly changes the feature version.

## 9. Error Handling

Startup fails closed with a concise non-PHI console error when:

- required static assets are missing;
- the executable directory or selected data root is unsafe;
- the data root cannot be created or written without elevation;
- the loopback listener cannot start;
- cryptographic token generation fails.

The helper must not fall back to a LAN bind, fixed port, unauthenticated mode, temporary PowerShell script, installation step, or elevated restart.

Malformed requests, unauthorized requests, oversized content, network failures, protocol warnings, and peer failures preserve their existing bounded classifications. Exceptions must not expose raw request bodies, raw datasets, tokens, patient values, or unrestricted remote content.

## 10. Compatibility and Non-Regression Requirements

Acceptance requires parity with source commit `714e5c9d24a471f0c39e95e65441d2416e65ad53`:

1. Browser assets require no product redesign and use the same local API contract.
2. The helper listens only on `127.0.0.1` at an OS-selected ephemeral port.
3. Session token entropy, validation, URL bootstrap, host/origin restrictions, and security headers remain effective.
4. Static path and data path traversal, including reparse/link escape, remains blocked.
5. Profiles, baselines, and sanitized history retain compatible schemas and atomicity.
6. Reviewed MLLP send remains explicit and idempotent; no background send is introduced.
7. C-ECHO, HTTP/TLS, MLLP, MWL, and Study Root protocol evidence and classifications remain unchanged.
8. MWL and Study Root response bounds, cancellation, character-set, malformed-response, and PHI rules remain unchanged.
9. Checkpoint 7.2 comparison and global navigation remain browser-only and behaviorally unchanged.
10. No PowerShell process, script, or module is required or started on the workstation.

## 11. Verification Strategy

### 11.1 Automated development verification

- Unit tests for token generation/comparison, host/origin authorization, request limits, security headers, safe static paths, data containment, and reparse-point rejection.
- Unit tests for profile, baseline, sanitized-history, reviewed-send, and MLLP validation/serialization behavior.
- Contract tests comparing old and new local API responses for synthetic valid and invalid requests, including exact route/status/JSON/security-header behavior.
- Existing endpoint, HTTP/TLS, MLLP, MWL, and Study Root controlled-peer suites against the executable.
- Existing browser suites against the executable, covering Home, Inspect, Diagnostics, cases, ORM/MWL comparison, navigation, End Session, and Clear behavior.
- Regression tests for 100-result C-CANCEL, Orthanc-shaped split pending Identifier handling, peer aborts, malformed responses, and character sets.
- Package allowlist, hash/manifest, secret/PHI/developer-path, and forbidden-extension scans.
- Syntax/build checks and `git diff --check`.

PowerShell may be used by development-only legacy comparison tests on a development machine. It is not used by the packaged-runtime tests and is not shipped.

### 11.2 Packaged Windows verification

On a standard-user Windows x64 account with effective PowerShell policy `Restricted` and no separately installed .NET runtime dependency:

1. Extract the versioned ZIP to a user-writable location.
2. Confirm the package contains no `.ps1`, `.psm1`, or `.cmd` launcher and no development/test artifacts.
3. Double-click `Kairo.Helper.exe`.
4. Confirm no UAC, installer, firewall prompt, execution-policy change, or dependency download occurs.
5. Confirm process inspection shows no `powershell.exe`/`pwsh.exe` child.
6. Confirm the listener is only `127.0.0.1` on an OS-selected ephemeral port.
7. Confirm Home, Inspect, Diagnostics, profiles/baselines, MLLP, MWL, Study Root, cases, comparison, navigation, and global controls open and behave as accepted.
8. Repeat controlled protocol tests and the authorized Orthanc Study Root acceptance using synthetic data.
9. Confirm Clear and End Session behavior, clean initial runtime data, no PHI/log output, and no source-repository mutation.
10. Close the helper and confirm service access stops without claiming already-rendered browser memory was erased.

SmartScreen or application-control behavior must be recorded separately from Administrator/UAC behavior. A trust prompt caused by unsigned/MOTW distribution is a distribution limitation, not a runtime or elevation dependency.

## 12. Release Acceptance Criteria

The no-PowerShell workstation runtime is ready only when all of the following are true:

- it launches under effective PowerShell policy `Restricted` without starting PowerShell;
- it runs as a standard user with no UAC, installer, system changes, or external runtime;
- it binds only to `127.0.0.1` on an ephemeral port and preserves authentication;
- the package is constructed from an explicit runtime allowlist and passes the privacy/development-artifact audit;
- API contract, browser behavior, persistence formats, and Stage 1–7.3 protocol behavior pass non-regression verification;
- controlled and real Windows manual acceptance pass;
- the release manifest and SHA-256 identify the immutable package and source commit;
- no Checkpoint 7.4 or unrelated product work is included.

## 13. Rollback

The migration is additive until acceptance. The source PowerShell helper remains available in source control as the known-good development reference but is not included in the workstation release.

Rollback consists of closing the executable, deleting or archiving the extracted executable release folder, and returning to the previously accepted source checkpoint or approved internal package. No uninstall, registry cleanup, service removal, firewall rollback, or execution-policy restoration is required because the executable creates none of those changes.

The executable must preserve existing application-data schemas so rollback does not require conversion. Old and new helpers must not run concurrently against the same data root. Before testing a rollback with existing nonempty data, use the already approved backup practice; never copy patient-bearing session memory into the data root.

## 14. Explicit Exclusions

This specification does not include:

- Checkpoint 7.4, Checkpoint 7.5, or Stage 8;
- new clinical or protocol features;
- changes to accepted browser UX or network semantics;
- Patient Root, C-MOVE, C-GET, C-STORE, or additional DICOM services;
- an installer, updater, Windows service, browser extension, or native messaging;
- code signing implementation or enterprise policy modification;
- NativeAOT or single-file publishing;
- x86 or ARM64 workstation packages;
- automatic migration, discovery, retries, telemetry, or crash upload.

## 15. Known Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Behavioral drift while porting PowerShell validation and serialization | Route-level golden contract tests plus existing browser and protocol suites. |
| Path/reparse handling differs between PowerShell and .NET | Dedicated Windows filesystem security tests, fail-closed containment, and no elevated fallback. |
| Legacy encodings are unavailable by default in modern .NET | Register and test the required code-page provider explicitly. |
| Self-contained folder is large or partially copied | Manifest every file, verify hashes, and distribute a versioned ZIP. |
| Unsigned executable receives SmartScreen/MOTW warnings | Do not bypass controls; use approved internal transfer initially and pursue trusted Authenticode signing separately. |
| Antivirus treats networking executable cautiously | Keep loopback-only listener, transparent folder contents, no obfuscation/self-extraction, and document explicit outbound actions. |
| Data root is placed in a non-writable location | Detect at startup and fail clearly without elevation; instruct extraction to a user-writable approved location. |
| Development laptop lacks the required .NET SDK | Install/pin the SDK only in the development environment before implementation; the published workstation artifact remains self-contained. |

## 16. Open Decisions

None. Exact project filenames and the pinned SDK patch version are implementation details governed by this architecture, not unresolved product decisions.

## 17. Workstation Runtime Build 1 Acceptance Record

Manual Windows acceptance passed on 2026-09-09 for **Kairo HL7 Toolkit v0.7.3 — Workstation Runtime Build 1**, built from source feature checkpoint `714e5c9d24a471f0c39e95e65441d2416e65ad53`.

The published `Kairo.Helper.exe` launched from the extracted self-contained runtime folder under a standard-user token. It opened the browser and loaded Kairo without executing PowerShell scripts or modules, requesting Administrator rights or UAC elevation, running an installer, downloading dependencies, or requiring a separately installed runtime. No firewall prompt was observed.

Windows SmartScreen displayed the expected **Unknown Publisher** warning because Runtime Build 1 is unsigned. On the development laptop, the tester explicitly selected **Run anyway**, after which Kairo operated normally. This is a code-signing and distribution-trust limitation; it is not a runtime, Administrator, UAC, installation, PowerShell, or external-runtime dependency. Kairo does not weaken Windows security controls, bypass SmartScreen, change execution policy, or automatically unblock downloaded files.

Runtime Build 1 retains feature version `0.7.3`. Code signing, trusted publisher reputation, enterprise allowlisting, Checkpoint 7.4, and Stage 8 remain separate future work.
