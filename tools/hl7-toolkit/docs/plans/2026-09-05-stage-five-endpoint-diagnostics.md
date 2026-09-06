# Stage Five endpoint diagnostics — sequential plan

Use one primary agent, no parallel execution, no worktrees. User-approved scope is in the adjacent Stage Five specification. Stop after the first TCP + C-ECHO real-UI checkpoint.

1. [x] **TCP service path:** add focused Windows-runtime tests first; implement `service/EndpointDiagnostics.cs`, its PowerShell adapter, and authenticated `/api/diagnostics/run` integration. Verify input rejection, DNS/literal IP, TCP success/refusal/timeout classification and no payload bytes. Record progress.
2. [x] **DICOM Verification:** extend focused controlled-peer tests first; implement bounded UL association and C-ECHO request/response parsing, response correlation, fragmentation, RJ/context rejection/abort/timeouts/status classification and socket disposal. Compile and test through the actual helper. Record progress.
3. [x] **Existing UI workflow:** add `diagnostics-ui.mjs`, Diagnostics navigation and controls, mount using the existing authenticated API. Verify busy/error states and layer rendering. Launch actual Windows helper and exercise the real browser against controlled endpoints. Record evidence/manual steps, commit and push `kairo-v1`, then stop.

Later Stage Five (not part of this execution): HTTP/TLS inspection → MLLP diagnostic integration → endpoint profiles → baseline comparison → practical evidence correlation. These require their own bounded implementation tasks. Stage Six remains unstarted.
