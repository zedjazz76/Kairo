# Stage Five endpoint diagnostics — sequential plan

Use one primary agent, no parallel execution, no worktrees. User-approved scope is in the adjacent Stage Five specification. Stop after the final Stage Five real-UI checkpoint; do not begin Stage Six.

1. [x] **TCP service path:** add focused Windows-runtime tests first; implement `service/EndpointDiagnostics.cs`, its PowerShell adapter, and authenticated `/api/diagnostics/run` integration. Verify input rejection, DNS/literal IP, TCP success/refusal/timeout classification and no payload bytes. Record progress.
2. [x] **DICOM Verification:** extend focused controlled-peer tests first; implement bounded UL association and C-ECHO request/response parsing, response correlation, fragmentation, RJ/context rejection/abort/timeouts/status classification and socket disposal. Compile and test through the actual helper. Record progress.
3. [x] **Existing UI workflow:** add `diagnostics-ui.mjs`, Diagnostics navigation and controls, mount using the existing authenticated API. Verify busy/error states and layer rendering. Launch actual Windows helper and exercise the real browser against controlled endpoints. Record evidence/manual steps, commit and push `kairo-v1`, then stop.

4. [x] **HTTP/TLS inspection:** add a bounded one-request HTTP/HTTPS diagnostic with separate DNS, TCP, TLS, and HTTP evidence; verify through the real UI.
5. [x] **Safe HL7/MLLP diagnostics:** add explicit zero-payload reachability and one generated synthetic-message action with correlated ACK interpretation; verify through the real UI.
6. [x] **Endpoint profiles:** extend local technical profiles for every diagnostic type and add explicit create/edit/select/delete controls to Diagnostics.
7. [x] **Known-good baselines:** persist allowlisted successful technical results per profile and report only meaningful changes on later matching runs.
8. [x] **Evidence correlation:** summarize observed session evidence, likely troubleshooting boundary, missing evidence, and smallest useful next check without overstating certainty.
9. [x] **Final manual acceptance:** the actual Windows UI passed profile create/select/edit/delete, control population without automatic execution, successful DICOM baseline save/reload, controlled wrong-port comparison at the TCP layer, and the four-part conservative evidence summary under the standard-user-only boundary. Commit and push, then stop. Stage Six remains unstarted.
