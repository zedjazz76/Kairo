# No-PowerShell Workstation Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce Kairo HL7 Toolkit v0.7.3 Workstation Runtime Build 1 as a self-contained `win-x64` folder led by `Kairo.Helper.exe`, with no workstation PowerShell or external runtime dependency.

**Architecture:** Add a pinned .NET console/test solution beside the accepted browser assets. The executable uses `TcpListener(IPAddress.Loopback, 0)`, focused security, persistence, protocol, and routing services, and compiles the accepted C# diagnostic/query engines directly. A development-only release builder publishes to a temporary staging tree, copies an explicit allowlist, audits it, emits hashes and release metadata, zips it, and tests the extracted package.

**Tech Stack:** .NET 10 SDK pinned by `global.json`; C#; xUnit; existing browser JavaScript/Node tests; self-contained `win-x64` folder publish.

**Spec:** `tools/hl7-toolkit/docs/specs/2026-09-08-no-powershell-workstation-runtime.md`

**Completion:** Implemented and manually accepted on Windows on 2026-09-09 as Workstation Runtime Build 1. The unsigned executable produced the expected SmartScreen Unknown Publisher warning; no bypass or policy change was added.

## Global Constraints

- Product version stays `0.7.3`; runtime identity is `Kairo HL7 Toolkit v0.7.3 / Workstation Runtime Build 1`.
- Source checkpoint is `714e5c9d24a471f0c39e95e65441d2416e65ad53`; Checkpoint 7.4 and feature work remain out of scope.
- Publish `Release`, `win-x64`, self-contained, `PublishSingleFile=false`, `PublishAot=false`.
- Workstation requires no PowerShell, execution-policy change, administrator, UAC, installer, .NET installation, Node, Python, Java, WSL, Git, Codex, service, registry change, or firewall change.
- Bind exactly `127.0.0.1` on port `0`; authenticate every API request; do no scanning, discovery, telemetry, update, retry, or outbound activity without an explicit user action.
- Preserve accepted API shapes, browser assets, protocol implementations, persistence schemas, limits, classifications, PHI boundaries, and Stage 1-7.3 behavior.
- Never package `.ps1`, `.psm1`, `.cmd`, source, tests, fixtures, developer paths, logs, credentials, PHI, or the pre-existing untracked ZIP files.
- Do not commit generated release artifacts unless separately authorized.

---

### Task 1: Project shell, pinned SDK, and runtime identity

**Files:**
- Create: `tools/hl7-toolkit/global.json`
- Create: `tools/hl7-toolkit/runtime/Kairo.Helper/Kairo.Helper.csproj`
- Create: `tools/hl7-toolkit/runtime/Kairo.Helper/Program.cs`
- Create: `tools/hl7-toolkit/runtime/Kairo.Helper/RuntimeIdentity.cs`
- Create: `tools/hl7-toolkit/runtime/Kairo.Helper.Tests/Kairo.Helper.Tests.csproj`
- Create: `tools/hl7-toolkit/runtime/Kairo.Helper.Tests/RuntimeIdentityTests.cs`
- Create: `tools/hl7-toolkit/runtime/Kairo.Workstation.slnx`

**Interfaces:**
- Produces: `RuntimeIdentity.ProductName`, `FeatureVersion`, `RuntimeBuild`, `SourceCheckpoint`, and an executable assembly named `Kairo.Helper`.

- [ ] Write `RuntimeIdentityTests` asserting the exact approved identity literals and project publish properties.
- [ ] Run `dotnet test ... --filter RuntimeIdentityTests`; expect failure because the project/identity does not exist.
- [ ] Add the minimal SDK-pinned solution and identity implementation, with `asInvoker` application manifest and linked compile items for `EndpointDiagnostics.cs`, `HttpTlsDiagnostics.cs`, and `DicomQueryDiagnostics.cs`.
- [ ] Re-run the targeted tests, then the solution tests; expect PASS.
- [ ] Commit the task without adding the authoritative spec or pre-existing ZIPs.

### Task 2: Loopback security, authentication, and safe paths

**Files:**
- Create: `runtime/Kairo.Helper/Security/SessionSecurity.cs`
- Create: `runtime/Kairo.Helper/Security/PathSecurity.cs`
- Create: `runtime/Kairo.Helper.Tests/Security/SessionSecurityTests.cs`
- Create: `runtime/Kairo.Helper.Tests/Security/PathSecurityTests.cs`

**Interfaces:**
- Produces: `SessionSecurity.CreateToken()`, `FixedTimeTokenEquals(...)`, `IsAuthorizedHost(...)`, `IsAuthorizedOrigin(...)`, `IsLoopback(...)`; `PathSecurity.ResolveStaticPath(root, urlPath)` and `ValidateDataPath(root, candidate)`.

- [ ] Add tests for 32-byte cryptographic tokens, fixed-time matching, exact loopback/host/origin acceptance, traversal/alternate-separator/rooted-path rejection, and linked/reparse escape rejection.
- [ ] Run the targeted tests and confirm failures identify missing security/path services.
- [ ] Implement the smallest ordinal/fail-closed services using canonical paths and link/reparse inspection on every existing ancestor.
- [ ] Re-run targeted and solution tests; expect PASS.
- [ ] Commit the task.

### Task 3: Bounded loopback HTTP host and static application

**Files:**
- Create: `runtime/Kairo.Helper/Hosting/HttpModels.cs`
- Create: `runtime/Kairo.Helper/Hosting/BoundedHttpParser.cs`
- Create: `runtime/Kairo.Helper/Hosting/HttpResponseWriter.cs`
- Create: `runtime/Kairo.Helper/Hosting/StaticFileService.cs`
- Create: `runtime/Kairo.Helper/Hosting/LoopbackHost.cs`
- Create: `runtime/Kairo.Helper/Bootstrap.cs`
- Create: `runtime/Kairo.Helper.Tests/Hosting/HttpHostTests.cs`
- Modify: `runtime/Kairo.Helper/Program.cs`

**Interfaces:**
- Produces: `LoopbackHost.StartAsync(IPAddress.Loopback, 0, token, appRoot, dataRoot, cancellationToken)` returning the selected port; authenticated `/api/session`; static `/` and `/definitions/...`; test-injectable browser launcher.

- [ ] Add real-socket tests for loopback-only ephemeral binding, request/header/body bounds, Host/Origin/token failures, security/no-cache headers, static MIME delivery, traversal rejection, API no-fallthrough, and missing-assets startup failure.
- [ ] Run targeted tests and confirm expected missing-host failures.
- [ ] Implement minimal parsing, one-request/close responses, static serving, session routing, cryptographic token bootstrap, and shell browser launch only after listener readiness.
- [ ] Run targeted, solution, and existing browser contract tests; expect PASS.
- [ ] Commit the task.

### Task 4: Runtime data, profiles, baselines, and sanitized history

**Files:**
- Create: `runtime/Kairo.Helper/Persistence/AtomicFiles.cs`
- Create: `runtime/Kairo.Helper/Persistence/ProfileRepository.cs`
- Create: `runtime/Kairo.Helper/Persistence/BaselineRepository.cs`
- Create: `runtime/Kairo.Helper/Persistence/HistoryRepository.cs`
- Create: `runtime/Kairo.Helper.Tests/Persistence/PersistenceContractTests.cs`
- Modify: `runtime/Kairo.Helper/Hosting/LoopbackHost.cs`

**Interfaces:**
- Produces compatible GET/POST/DELETE routes at `/api/profiles/endpoint`, `/api/diagnostics/baseline`, `/api/history`, `/api/history/events`, and `/api/history/session` using only `data/runtime`.

- [ ] Add literal-fixture tests for valid/invalid schemas, filename containment, atomic replacement, NDJSON append/index reconciliation, list/read/delete, and absence of raw PHI-bearing fields.
- [ ] Run tests and confirm route/repository failures.
- [ ] Port validation ordering and serialized field shapes from the accepted modules with lazy directory creation.
- [ ] Re-run targeted, solution, history/privacy, and profile browser tests; expect PASS.
- [ ] Commit the task.

### Task 5: Endpoint and HTTP/TLS diagnostic adapters

**Files:**
- Create: `runtime/Kairo.Helper/Diagnostics/DiagnosticRoutes.cs`
- Create: `runtime/Kairo.Helper.Tests/Diagnostics/DiagnosticRouteTests.cs`
- Modify: `runtime/Kairo.Helper/Hosting/LoopbackHost.cs`

**Interfaces:**
- Produces: authenticated `POST /api/diagnostics/run`, strict DTO validation, and direct calls into the linked accepted C# endpoint and HTTP/TLS engines.

- [ ] Add synthetic request/response contract tests for validation order, status codes, JSON names/nulls, explicit invocation, and bounded safe errors.
- [ ] Confirm RED because the route/adapter is absent.
- [ ] Implement minimal typed mapping and dispatch without changing the accepted protocol engines.
- [ ] Run targeted, solution, endpoint diagnostic, and HTTP safety suites; expect PASS.
- [ ] Commit the task.

### Task 6: MLLP connectivity and reviewed one-message send

**Files:**
- Create: `runtime/Kairo.Helper/Mllp/MllpClient.cs`
- Create: `runtime/Kairo.Helper/Mllp/ReviewedSendService.cs`
- Create: `runtime/Kairo.Helper.Tests/Mllp/MllpTests.cs`
- Modify: `runtime/Kairo.Helper/Hosting/LoopbackHost.cs`

**Interfaces:**
- Produces: authenticated `POST /api/mllp/check` and `/api/mllp/send-one`, accepted encodings/framing/timeouts/ACK evidence, and in-memory idempotency keyed by reviewed send identifier.

- [ ] Add a controlled TCP peer and tests for framing, UTF-8/default and legacy encodings, bounded connect/read, incomplete frames, ACK handling, explicit-only send, and duplicate-send suppression.
- [ ] Confirm RED against missing MLLP services.
- [ ] Register code pages and port only the accepted bounded MLLP behavior.
- [ ] Run targeted, solution, MLLP ACK, send API, and send workflow suites; expect PASS.
- [ ] Commit the task.

### Task 7: MWL C-FIND adapter

**Files:**
- Create: `runtime/Kairo.Helper/Dicom/MwlRoutes.cs`
- Create: `runtime/Kairo.Helper.Tests/Dicom/MwlRouteTests.cs`
- Modify: `runtime/Kairo.Helper/Hosting/LoopbackHost.cs`

**Interfaces:**
- Produces: authenticated `POST /api/dicom/mwl/find` with strict accepted request mapping into `DicomQueryDiagnostics.MwlClient`.

- [ ] Add literal invalid-payload tests plus controlled-SCP tests for pending/final statuses, result limit/C-CANCEL, malformed responses, character sets, and safe serialization.
- [ ] Confirm RED because the route adapter is absent.
- [ ] Implement the minimal validator/adapter while leaving the accepted C-FIND core unchanged.
- [ ] Run targeted, solution, MWL model/query/UI/workflow suites; expect PASS.
- [ ] Commit the task.

### Task 8: Study Root C-FIND adapter

**Files:**
- Create: `runtime/Kairo.Helper/Dicom/StudyQueryRoutes.cs`
- Create: `runtime/Kairo.Helper.Tests/Dicom/StudyQueryRouteTests.cs`
- Modify: `runtime/Kairo.Helper/Hosting/LoopbackHost.cs`

**Interfaces:**
- Produces: authenticated `POST /api/dicom/studies/find` with strict accepted request mapping into `DicomQueryDiagnostics.StudyQueryClient`.

- [ ] Add literal validation tests and controlled-SCP tests for query level, UID/date/text bounds, split pending identifiers, result limit/C-CANCEL, abort/malformed responses, character sets, and privacy-safe output.
- [ ] Confirm RED because the route adapter is absent.
- [ ] Implement the minimal validator/adapter without changing protocol semantics.
- [ ] Run targeted, solution, Study Query model/query/UI suites; expect PASS.
- [ ] Commit the task.

### Task 9: Shutdown, session lifecycle, and browser non-regression

**Files:**
- Create: `runtime/Kairo.Helper.Tests/Hosting/LifecycleTests.cs`
- Modify: `runtime/Kairo.Helper/Bootstrap.cs`
- Modify: `runtime/Kairo.Helper/Hosting/LoopbackHost.cs`

**Interfaces:**
- Produces graceful Ctrl+C/process cancellation, listener disposal, no disk snapshot on shutdown, and no service/background persistence.

- [ ] Add tests that cancellation closes the listener, blocks new requests, preserves only approved persisted records, emits no token/PHI, and launches the browser once with the authenticated URL.
- [ ] Confirm RED on missing lifecycle behavior.
- [ ] Implement minimal cancellation/disposal and safe startup/error messages.
- [ ] Run solution tests and all existing Node suites for Home, Inspect, Compare, Validate, Case, Send, History, diagnostics, selectors/navigation, Quick Guides, Clear, and End Session.
- [ ] Commit the task.

### Task 10: Self-contained publish and release packaging

**Files:**
- Create: `tools/hl7-toolkit/build-workstation-runtime.sh`
- Create: `tools/hl7-toolkit/runtime/Kairo.Helper.Tests/Packaging/PackageTests.cs`
- Create during build only: `dist/Kairo-HL7-Toolkit-v0.7.3-win1/`, `.zip`, and `.zip.sha256`

**Interfaces:**
- Produces an audited extracted folder and `Kairo-HL7-Toolkit-v0.7.3-win1.zip` with `VERSION.txt`, `README-RUN.txt`, `RELEASE-NOTES.md`, and `RELEASE-MANIFEST.json`.

- [ ] Add black-box tests for exact release identity, executable/runtime presence, clean data layout, manifest/hash verification, no forbidden extensions/source/dev paths/canaries, and independence from repo paths.
- [ ] Run packaging tests and confirm RED because the builder/artifact is absent.
- [ ] Implement a Bash development-only builder using a clean temporary stage, explicit input allowlists, `dotnet publish -r win-x64 --self-contained true -p:PublishSingleFile=false -p:PublishAot=false`, deterministic documents/manifest, ZIP creation, clean extraction, and audits.
- [ ] Build the actual package, run tests against the extracted package, and verify its SHA-256.
- [ ] Run `git diff --check`; keep `dist/` uncommitted/ignored and commit only builder/tests/project sources.

### Task 11: Real workstation manual-verification readiness gate

**Files:**
- Modify only if evidence requires a TDD runtime/package fix; increment Runtime Build if packaged content changes after acceptance.

**Interfaces:**
- Produces the exact manual verification instructions and evidence bundle; it does not claim final workstation acceptance before Windows testing.

- [ ] Transfer/extract the produced ZIP to a standard-user Windows x64 environment with effective PowerShell execution policy `Restricted` and no separately installed .NET runtime dependency.
- [ ] Double-click `Kairo.Helper.exe`; record no UAC/installer/firewall prompt/download, default browser launch, ephemeral `127.0.0.1` listener, and absence of PowerShell children.
- [ ] Exercise the actual extracted package across representative browser/API workflows and controlled MLLP/MWL/Study Root peers; verify clean runtime data, Clear/End Session, and helper-close behavior.
- [ ] Audit the tested folder for manifest integrity, test/dev artifacts, developer paths, PHI, logs, and forbidden scripts.
- [ ] If Windows is unavailable, stop at `Ready for manual verification`; report the exact artifact and remaining manual acceptance without claiming workstation success.

## Self-Review Record

- Spec coverage: Tasks 1-11 cover architecture, security, API/static behavior, persistence/privacy, each protocol boundary, lifecycle, publish/audit, and actual-package Windows acceptance.
- Placeholder scan: no deferred implementation placeholders; every migration boundary names its tests, failure reason, implementation, regressions, and commit gate.
- Type consistency: host/security/persistence/adapter interfaces are introduced before consumers; both DICOM routes call the existing linked shared engine; packaging consumes the completed executable and accepted asset tree.
- Recovery constraint: the plan starts from the observed clean tracked checkpoint, does not touch the two pre-existing untracked ZIPs, uses no subagents/worktrees, and does not begin Checkpoint 7.4.
