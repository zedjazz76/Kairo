# Stage Five — Vendor-neutral live endpoint diagnostics

Status: product direction approved by the user, September 5, 2026. Additive to the accepted Stage 1–4 toolkit. The prior direction blocker at `32888b4` is resolved by that approval.

## Objective and scope

Provide local, analyst-initiated live evidence to distinguish DNS, network, protocol negotiation, and application failures. Approved Stage Five scope comprises TCP; HTTP/HTTPS status, redirects, safe headers and TLS/certificate inspection; DICOM Verification/C-ECHO; safe MLLP reachability and ACK interpretation; technical endpoint profiles; known-good baseline comparison; and correlation with artifact evidence that separates observations, inferences and missing evidence.

The first checkpoint implements **TCP and DICOM C-ECHO only**, reachable in the existing Kairo navigation. Defer the other capabilities. Do not begin Stage Six.

## First checkpoint contract

Inputs: one hostname/IP, one port (1–65535), timeout per layer (100–10000 ms, default 3000), mode TCP or DICOM, and Calling/Called AE titles for DICOM (1–16 printable ASCII characters excluding backslash/control characters, not all spaces). Reject arrays, URL paths, wildcards, host/port ranges and malformed inputs before networking.

Output: UTC timestamp, entered host/port/mode, selected resolved IP, total elapsed time, and separate DNS → TCP → association → C-ECHO states. Each layer has state, classification, timing and an analyst-friendly explanation. Subsequent layers are NOT_RUN after failure. Literal IP input labels DNS NOT_REQUIRED. Resolve one host and use one returned address only, explicitly displayed; no automatic address retries.

TCP success proves a connection only, with zero application bytes sent. Classify DNS failure/timeout, TCP timeout/refusal and other network errors. DICOM sends A-ASSOCIATE-RQ for Verification SOP Class `1.2.840.10008.1.1`, negotiates Implicit VR Little Endian for the command exchange, sends one C-ECHO-RQ, validates response context/command/message correlation/status, and releases/closes the association. Distinguish TCP failure, association rejection (numeric result/source/reason and interpretation), unsupported Verification presentation context, abort, malformed/incomplete response, timeout, nonzero C-ECHO status and C-ECHO success. Bound PDUs, command bytes and read deadlines; allow fragmented network reads and command PDVs.

## Architecture and safety

Add an authenticated POST `/api/diagnostics/run` to the existing PowerShell loopback service and a separate .NET/C# protocol module compiled in memory by the existing runtime on first diagnostic use. If runtime policy blocks the optional module, return DIAGNOSTIC_RUNTIME_UNAVAILABLE while leaving existing workspaces available. No installed dependency or separate service is required. Add a Diagnostics workspace with existing navigation and styling. Preserve all existing routes and tools. One active UI request at a time; no automatic runs, retries, scanning or host discovery. Explicit buttons identify TCP-only versus DICOM Verification traffic. No HL7 patient messages, credentials, datasets or destructive commands are sent. Inputs/results remain session-only and are not added to history or logged. Do not invoke shell commands from endpoint input.

## Acceptance

1. Real UI navigation reaches host/port/timeout/AE inputs and both explicit actions; busy/error handling allows safe retry by the analyst.
2. Local loopback TCP listener succeeds without application bytes; closed port is CONNECTION_REFUSED; DNS failure and network timeout have separate classifications.
3. DICOM peer accepts Verification and returns correlated status 0000: every applicable layer succeeds. Request AE titles, SOP class and command framing are correct.
4. Association RJ, denied Verification context, peer abort, response timeout, malformed/oversized frames, wrong message/context/command and nonzero status never report C-ECHO success. TCP success remains visible after protocol failure.
5. Fragmented PDU/PDV responses parse correctly. All attempts close sockets and are bounded; results contain no raw server text or PHI.
6. Protected API rejects unauthorized and invalid requests before outbound I/O. Targeted existing UI/API regressions pass.
7. Actual Windows launcher runs and the first diagnostic compiles/loads the new module. Real browser workflow is exercised against controlled local peers for TCP, C-ECHO success and layered failures. Record exact limitations, update progress/handoff, commit/push, and stop.

Protocol basis: DICOM PS3.8 §9.3 (UL PDU structures) and PS3.7 §9.3.5 (C-ECHO messages):
https://dicom.nema.org/medical/dicom/current/output/chtml/part08/sect_9.3.html
https://dicom.nema.org/medical/dicom/current/output/chtml/part07/sect_9.3.5.html

## Standard-user enterprise boundary — explicit user requirement, September 6

All Stage Five behavior must run using a normal non-elevated Windows token and documented user-mode networking. No Administrator requirement, UAC elevation, installed services/drivers, raw sockets, capture/sniffing, injection, privileged APIs, security bypasses, persistence mechanisms, or system-wide registry/firewall/routing/DNS/adapter changes. Never enumerate hosts/ports/networks or silently repeat probes. The first checkpoint makes exactly one address selection/connection and at most one normal Verification association/request per explicit click. No probe loop or worker runs in the background. A blocked connection is reported without weakening workstation policy. Standard-user acceptance includes verifying the Windows test token is medium integrity, not high/system integrity and running the actual launcher under that inherited token. Codex sandbox grants are not Windows privilege elevation.

The existing Stage One launcher is preserved, including its pre-existing process-scoped PowerShell invocation; Stage Five adds no execution-policy override or workstation policy change. Enterprise allowlisting/Constrained Language restrictions are not bypassed by the diagnostics module. If the existing launcher itself is blocked, report the restriction rather than changing workstation policy.
