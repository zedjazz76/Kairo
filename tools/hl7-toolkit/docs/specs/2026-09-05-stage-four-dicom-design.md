# Stage Four DICOM Design

**Status:** Approved September 5, 2026. **Boundary:** additive to Stages 1–3.

## Outcome

Kairo adds a local DICOM troubleshooting workspace alongside its unchanged HL7 workspaces. It reads metadata only; it does not render pixels, operate a PACS/RIS, open a DICOM listener, or claim clinical or network certainty.

## Additive architecture

New browser modules parse a selected local Part 10 DICOM file, normalized DICOM JSON/MWL data, and user-supplied association text into a common in-memory artifact. Existing history receives only the existing sanitized event format. Existing navigation and validation presentation are extended with a DICOM workspace; no HL7 API, helper endpoint, or Stage 1–3 behavior changes.

The core provides dictionary lookup, UID/transfer-syntax explanation, metadata summary and findings, MWL/association/DIMSE explanation, correlation with a selected HL7 message, artifact comparison, workflow-boundary guidance, and a redacted copy view. Each result labels evidence as match, mismatch, not available, or site mapping required; it never treats metadata as proof of rejection or connectivity.

## Definitions and provenance

Kairo vendors the MIT-licensed `dcmjs` data dictionary snapshot and its required copyright/license notice, pinned with source URL and revision in `app/definitions/DICOM-PROVENANCE.md`. The snapshot supplies tag/VR/VM/keyword and UID metadata. Kairo-authored concise explanations and workflow guidance are separate. No NEMA DICOM registry is copied directly, no proprietary private dictionary is shipped, and a site may load a local mapping only in browser memory.

Source: [dcmjs dictionary and MIT license](https://github.com/dcmjs-org/dcmjs). The upstream dictionary is generated from NEMA PS3.6, whose registry defines tag, name, VR, VM, and UID fields ([PS3.6](https://dicom.nema.org/medical/dicom/current/output/chtml/part06/ps3.6.html)).

## Acceptance criteria

1. Local metadata parsing identifies the listed patient, study, series, instance, equipment, and workflow tags without pixel rendering and preserves source bytes in memory only.
2. Dictionary search finds standard tag, keyword, or name and returns tag/name/keyword/VR/VM/category/explanation.
3. Common SOP, transfer-syntax, storage, query/retrieve, MWL, SR, and presentation-state UIDs have safe explanations.
4. Object summaries and findings identify missing identifiers, malformed UIDs, unknown UIDs, missing modality, and potential—not proven—compatibility concerns.
5. MWL, association, and DIMSE explainers return structured evidence and recommended next checks without network claims.
6. HL7-to-DICOM/MWL correlation returns only MATCH, MISMATCH, NOT AVAILABLE, or SITE MAPPING REQUIRED; local mappings remain session-only.
7. Comparison and workflow guidance prioritize identifiers and report missing evidence and a possible boundary without certainty.
8. A redacted troubleshooting copy view removes common patient identifiers while retaining technical metadata.
9. Existing Stage 1–3 targeted tests continue to pass.
