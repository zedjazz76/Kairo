# Stage Three Validation Implementation Plan

**Spec:** `docs/specs/2026-09-05-stage-three-validation-design.md`

## Task 1 — Profile schema and evaluator — completed September 5, 2026

- Add a project-owned baseline profile pack and a pure evaluator that validates profile shape, selects a profile by declared version and MSH-9 family, evaluates cardinality/value/Z-segment rules, and emits safe repair suggestions.
- Add focused unit tests for matching, mismatch coverage, invalid packs, findings, and nonmutation.
- Verify: `node --test tests/hl7-toolkit/profile-validator.test.mjs`.

Completed files: `app/scripts/profile-validator.mjs`, `app/definitions/kairo-validation-baseline.v1.json`, and `tests/hl7-toolkit/profile-validator.test.mjs`. Verification: 3 tests passed. The baseline is deliberately a limited Kairo-owned policy pack; all standard-derived detail remains a local profile responsibility.

## Task 2 — Collection and workbench integration — completed September 5, 2026

- Extend the existing validation flow to combine basic and profile findings, evaluate safe collection metadata, and load a local site pack for the current browser session.
- Render profile status and informational suggestions without automatic edits.
- Add focused workflow and UI-contract coverage.
- Verify: profile, validator, and UI-contract tests.

Completed files: `app/index.html`, `app/scripts/app.mjs`, `app/scripts/workbench.mjs`, `app/scripts/profile-validator.mjs`, and the focused profile/UI tests. Verification: 12 targeted tests passed. The loaded site pack is parsed from a browser-selected file and retained only in that tab's memory.

## Task 3 — Final Stage Three verification and handoff

- Document local profile loading, distribution boundaries, and the coverage limitation.
- Run the Stage Three focused test set and the PowerShell service probe.
- Update the existing handoff/readme with completed tasks and the next stage.
