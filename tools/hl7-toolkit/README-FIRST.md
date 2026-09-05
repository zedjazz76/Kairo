# KAIRO Guardian HL7 Toolkit — laptop handoff

This package was created September 5, 2026 from commit `2c413f9` on branch `codex/hl7-toolkit-phase1`.

## Run the toolkit

1. Extract the ZIP to a local folder you can write to, such as Documents.
2. Open the `KAIRO-Guardian-HL7-Toolkit` folder.
3. Double-click `Open HL7 Toolkit.cmd`.
4. Keep the helper window open while using the browser page.

The toolkit does not require installation, compilation, administrator privileges, a Windows service, or a firewall rule. If Windows or organizational policy blocks scripts, ask your IT team rather than weakening the policy.

## Continue development

The `source` folder contains the Phase One tests, product and Phase One designs, and the implementation plan. Stage Two search and filter Tasks 1–2 (the pure filter engine and worker filtering) are complete and verified. Continue with the next unchecked task in `source/docs/plans/2026-09-05-stage-two-search-filter.md`.

This ZIP is a clean source handoff, not a Git repository. The work-laptop Git branch remains the authoritative Git copy.

## Privacy

The package intentionally excludes `data/runtime`, saved sanitized history, endpoint profiles, browser profiles, Git internals, and unrelated MANA wiki files. The toolkit creates a new local `data/runtime` folder on first use.

Use synthetic data for initial testing. Review sanitized output before sharing, and send HL7 only to an authorized destination over an approved network.
