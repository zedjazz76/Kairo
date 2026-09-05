# Stage Four DICOM Implementation Plan

1. **Definitions and pure DICOM core:** vendor attributed dictionary snapshot; add binary metadata parser, tag/UID lookup, summary, validation, and tests. **User-test checkpoint:** explicit-VR metadata parsing, the listed common tag coverage, initial SOP/transfer-syntax lookup, summary, validation, and provenance pass focused tests. Remaining: full dictionary snapshot and broader transfer-syntax coverage.
2. **DICOM workspace:** add local-file metadata inspection, search, summary/findings, and redacted copy UI using existing patterns. **User-test checkpoint:** local Part 10 file selection, metadata table, tag search, SOP explanation, summary, and findings are integrated in the existing DICOM navigation workspace. Remaining: redacted copy action.
3. **Diagnostic explainers:** add MWL JSON, association text, DIMSE, and workflow guidance with focused tests.
4. **Cross-protocol tools:** add HL7/DICOM/MWL correlation, session-only mapping, and meaningful artifact comparison tests.
5. **Final verification:** document limitations/provenance, run Stage 4 focused tests and service probe, update handoff.

Tasks are sequential. No DICOM object, mapping, or raw PHI is persisted.
