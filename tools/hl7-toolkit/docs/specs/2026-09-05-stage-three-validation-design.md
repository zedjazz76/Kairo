# Stage Three Validation Design

**Status:** Approved for implementation September 5, 2026  
**Parent:** `2026-09-03-hl7-toolkit-product-design.md`

## Established requirements

The approved product design assigns deep, version-aware validation to Stage Three. It requires structural checks, table checks, conformance profiles, site rule packs, Z-segment definitions, collection checks, and safe repair suggestions. Validation remains local, preserves unknown messages and Z-segments, never rewrites a message, and reports coverage limitations instead of implying full conformance.

## Scope for this stage

Stage Three adds an in-browser profile evaluator after the existing basic checks. A profile declares its identifier, supported declared versions, message-family selector, structural cardinality rules, value-set rules, optional Z-segment rules, and safe suggestions. The evaluator returns findings only; applying a suggestion remains an explicit user edit. A collection evaluator reports duplicate control IDs and profile-selected collection rules without retaining message content.

Kairo ships one small project-owned baseline pack for the message families already named by the product design (ADT, ORM/OMI, ORU, SIU, DFT, ACK). It verifies only the pack's declared checks. A message whose version or family has no matching profile receives `not-evaluated`, not an error.

Users may load a JSON site-profile pack through the browser File API for the current session. The pack remains in browser memory, is not sent to the helper, history, URLs, or logs, and can define local fields, value sets, cardinality, Z segments, collection checks, and suggestions. Invalid packs are rejected with safe error codes.

## Definition-source and distribution decision

HL7 standards material is copyrighted and official licensing information restricts reproduction without permission. Kairo therefore does **not** ship copied HL7 standard tables, segment definitions, or conformance profiles. It also does not incorporate HAPI HL7v2 definition data because that project is dual-licensed MPL/GPL and is unnecessary for this portable JavaScript application.

The shipped baseline is authored for Kairo from requirements already established in this repository. Its provenance file labels it as a limited product policy pack, not an HL7 standard or certification artifact. A deploying organization is responsible for the license and accuracy of any local profile it loads. Local profiles are consumed in memory only and are excluded from the repository and runtime history.

References: [HL7 web IP statement](https://cimi.hl7.org/IP_for_web.html) and [HAPI HL7v2 licensing](https://github.com/hapifhir/hapi-hl7v2/blob/master/pom.xml).

## Acceptance criteria

1. A declared-version and message-family matching profile produces structural, table, and Z-segment findings with severity, path, source, and safe suggested value where configured.
2. A profile mismatch produces an explicit `not-evaluated` finding and never rejects an otherwise parseable message.
3. Invalid profile input returns a safe validation error that contains neither a field value nor raw message content.
4. Site-profile JSON is evaluated only in browser memory and is not written through history or the local helper.
5. Collection rules report only safe metadata/counts; existing duplicate MSH-10 behavior remains intact.
6. Suggestions are informational and do not alter source text until an existing explicit edit action is used.
7. Existing basic validation and its send-preflight behavior remain unchanged.

## Out of scope

Kairo does not claim full HL7 conformance, redistribute HL7 reference databases, auto-repair messages, validate clinical semantics beyond a loaded profile, or persist site profiles in this stage.
