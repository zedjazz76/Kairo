# Stage Six — Guided troubleshooting case workflow

Status: product direction and first checkpoint approved by the user, September 6, 2026. Additive to completed and accepted Stage 1–5 functionality. Stage Seven is not approved.

Final Windows manual acceptance for the first checkpoint passed September 6, 2026 through the real Kairo UI under the standard-user-only boundary.

## Objective

Organize Kairo's existing HL7, DICOM, TCP, TLS, MLLP, endpoint-profile, baseline, and evidence-correlation results into a coherent analyst case. The workflow helps an analyst state the issue, collect safe evidence, identify the best-supported troubleshooting boundary, choose the smallest useful next check, and prepare a technical handoff. It does not remediate systems or replace analyst judgment.

## First checkpoint scope

The first user-testable checkpoint adds one active, browser-session troubleshooting case to the existing Kairo UI. The analyst can:

1. Create a case with title, system/workflow, environment, issue description, observed symptom, status, and analyst notes.
2. Add a manual note to the case timeline.
3. Attach the most recent existing diagnostic result and its current baseline comparison/evidence summary.
4. Review a timestamped evidence timeline.
5. Generate case-aware OBSERVED, LIKELY BOUNDARY, MISSING EVIDENCE, and NEXT CHECK sections.
6. Generate a concise text handoff for manual review and use elsewhere.

This checkpoint does not implement saved case history, reopen, archive, advanced checklists, automatic evidence capture, background monitoring, ticket/email transmission, or Stage Seven.

## Case and evidence model

The active case uses schema `kairo.troubleshooting-case.v1` and stays in browser memory. Required text is trimmed and bounded. Status is one of `OPEN`, `INVESTIGATING`, `BLOCKED`, or `RESOLVED`. The UI warns users not to enter patient-identifiable data, credentials, message bodies, or other secrets.

Timeline entries use schema `kairo.case-evidence.v1` and contain an ID, UTC timestamp, evidence type, source/tool, optional technical endpoint label, concise result, directly observed facts, and optional analyst note. The first checkpoint accepts manual notes and an allowlisted snapshot of the current diagnostic result. It never copies an imported HL7 message, raw DICOM dataset, HTTP response body, credential, certificate body, or other raw PHI-bearing content.

## Guided analysis and handoff

Case-aware guidance extends the Stage 5 correlation vocabulary. It derives claims from attached evidence only, presents qualified likely-boundary language, states missing evidence, and recommends the smallest useful next check. Manual notes are displayed as analyst-provided context and are not silently promoted to verified facts.

The handoff contains CASE, ISSUE, ENVIRONMENT, OBSERVED, TESTS PERFORMED, BASELINE CHANGES, LIKELY BOUNDARY, MISSING EVIDENCE, NEXT CHECK, BLOCKERS, and STATUS. It contains no hidden reasoning and is displayed locally for explicit analyst review. Kairo does not automatically copy or transmit it.

## Architecture

Add a pure browser-side case model module for validation, evidence attachment, timeline ordering, case-aware analysis, and handoff formatting. Add a small UI controller mounted from the existing application entry point and a Case workspace using existing navigation and styling. Extend Diagnostics with one explicit action that exposes an allowlisted snapshot of the last diagnostic to the Case controller. Existing diagnostic execution, profile/baseline persistence, and Stage 1–5 screens remain unchanged.

## Security and privacy

Everything runs as a normal standard user. The checkpoint adds no service, driver, elevation, UAC flow, raw socket, packet capture, scan, discovery, automatic probe, retry, system/firewall/registry change, remediation, monitoring, credential collection, cloud persistence, or transmission. Case content is session-only in this checkpoint. Only explicit user actions add evidence.

## Acceptance criteria

1. The real Kairo UI can create one active case and displays its title, status, system/workflow, environment, issue, and symptom.
2. A manual note can be explicitly added and appears as a timestamped timeline item.
3. After an existing diagnostic is run, one explicit action attaches an allowlisted technical snapshot; no diagnostic runs automatically and no raw clinical content is stored.
4. Timeline items display timestamp, evidence type/source, concise result, observed facts, optional endpoint, and analyst note in chronological order.
5. Case-aware analysis displays all four required sections and never states certainty beyond attached evidence.
6. Handoff output contains every required heading, reflects the active case and attached evidence, and is not automatically copied or transmitted.
7. Focused case-model, timeline, summary, UI, and syntax checks pass; existing Diagnostics remains mounted and usable.
8. Actual Windows standard-user UI acceptance exercises the complete first-checkpoint workflow before it is marked complete.
