# Stage Three Validation Implementation Plan

**Spec:** `docs/specs/2026-09-05-stage-three-validation-design.md`

## Task 1 — Profile schema and evaluator

- Add a project-owned baseline profile pack and a pure evaluator that validates profile shape, selects a profile by declared version and MSH-9 family, evaluates cardinality/value/Z-segment rules, and emits safe repair suggestions.
- Add focused unit tests for matching, mismatch coverage, invalid packs, findings, and nonmutation.
- Verify: `node --test tests/hl7-toolkit/profile-validator.test.mjs`.

## Task 2 — Collection and workbench integration

- Extend the existing validation flow to combine basic and profile findings, evaluate safe collection metadata, and load a local site pack for the current browser session.
- Render profile status and informational suggestions without automatic edits.
- Add focused workflow and UI-contract coverage.
- Verify: profile, validator, and UI-contract tests.

## Task 3 — Final Stage Three verification and handoff

- Document local profile loading, distribution boundaries, and the coverage limitation.
- Run the Stage Three focused test set and the PowerShell service probe.
- Update the existing handoff/readme with completed tasks and the next stage.
