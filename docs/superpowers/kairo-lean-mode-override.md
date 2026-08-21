# Kairo Superpowers Lean-Mode Override

From this point forward, operate Superpowers in **LEAN / COST-CONTROLLED MODE** for the Kairo project.

The objective is to preserve engineering quality, TDD, architectural integrity, and recoverability while dramatically reducing unnecessary model usage, repeated context ingestion, subagent activity, review loops, and duplicated documentation.

## Core rule

Use the **least expensive valid Superpowers workflow** that safely completes the current task.

Do not add process merely because a skill allows it.

Do not restart or redo completed work unless there is concrete evidence that it is incorrect.

## 1. Disable automatic subagents

Do **not** spawn subagents, delegated workers, parallel agents, independent reviewers, or secondary analysis agents by default.

Use the primary Codex agent for normal implementation and verification.

A subagent may be used only when:

1. The problem is genuinely independent and substantially benefits from parallel work.
2. The primary agent cannot reasonably complete it alone.
3. Robert explicitly approves spawning the subagent.

Before spawning one, state briefly why it is needed, what it will do, and why the primary agent cannot efficiently do it. Then wait for approval.

## 2. Eliminate per-task independent reviews

Do **not** perform an independent review after every implementation task.

For each normal task use: **Implement → focused verification → update progress ledger → stop.**

Perform one independent review only after approximately 3–4 related tasks, at a major architectural boundary, before a major milestone/release, or when Robert explicitly requests one. Do not recursively review the reviewer. One review pass is enough unless it identifies a concrete defect requiring remediation.

## 3. Use proportionate TDD

For a bounded feature or bug:

1. Write or identify the smallest meaningful failing test.
2. Confirm the failure.
3. Implement the minimum correct change.
4. Run the focused tests covering that change.
5. Run immediately related regression tests.
6. Stop when they pass.

Do not repeatedly run the entire project test suite after every tiny edit. Run the full regression suite only after a group of related tasks, before milestone completion, after a cross-cutting architectural change, or when focused tests indicate broader risk. Android compilation/build verification should happen when a task affects Android compilation boundaries, not automatically after every trivial edit.

## 4. Stop repeated repository rescanning

At the beginning of a task:

1. Read `progress.md`.
2. Read the relevant implementation-plan section.
3. Inspect only files directly related to that task.
4. Use `git diff`, Git status, and targeted searches to understand recent changes.

Reuse established project facts. Widen repository inspection only when evidence shows the task crosses additional boundaries.

## 5. Treat completed Tasks 1–4 as authoritative

Tasks 1–4 are complete. Do not restart them, regenerate their reports, repeat their independent reviews, or rerun their historical verification merely to begin a later task. Inspect them only when a direct dependency or failing test requires it. Resume from the preserved worktree and `progress.md`.

## 6. Reduce documentation overhead

Maintain one concise authoritative progress ledger. Do not create duplicate reports, temporary analysis documents, or redundant checkpoint documents unless they provide unique recovery value.

For each completed task, record only task number, materially changed files, tests run and result, commit hash when available, significant architectural decision, and next task. Prefer `progress.md`.

`docs/HANDOFF.md` and this file are explicitly approved recovery material for cross-machine continuation.

## 7. Use the lightest Superpowers classification possible

Prefer **Bounded** for existing Kairo flows when that classification genuinely fits. Do not escalate a task merely because it touches several files.

Use Architectural only when a task introduces a new subsystem, materially restructures component boundaries, changes a major interface contract, or changes an approved architectural decision. Mandatory approval gates remain in force, but design must remain proportional.

## 8. No recursive process

Never use implementation → reviewer → reviewer of reviewer → remediation reviewer → final reviewer → second verification reviewer.

Instead use implementation → focused verification → done. At a milestone, use implementation group → one independent review → concrete fixes → focused verification → done.

## 9. Limit retry loops

When a command, test, build, or approach fails: diagnose it, make a targeted correction, and retry. If essentially the same failure remains after two reasonable correction attempts, stop and report the exact failure, likely cause, evidence collected, and recommended next step. Do not spend large usage repeatedly attacking an environmental problem.

## 10. Prefer targeted context

Prefer exact files, relevant functions/classes, `git diff`, targeted searches, and focused tests. Avoid dumping entire directories, rereading huge generated files, loading unrelated history, or reconstructing facts already in `progress.md`.

## 11. Keep implementation responses concise

During autonomous implementation, use concise operational updates. A normal task completion report contains only what changed, tests/result, material issue or decision, commit/status, and next task.

## 12. Expensive-action approval gate

Ask Robert before spawning a subagent, launching parallel agents, starting an independent review, performing a full-repository architectural analysis, rerunning a large full regression suite when focused tests pass, creating a new architectural specification, or substantially expanding approved scope. State the reason in one or two sentences and wait for approval.

## 13. Model-conscious workflow

Treat model usage as a constrained project resource. Optimize for correctness per model call, not maximum process per task. Do not increase reasoning depth, delegate workers, or broaden analysis unless the task requires it. Do not compensate for a lower reasoning setting by multiplying review passes.

## 14. Preserve important safeguards

Lean mode does not mean careless mode. Preserve TDD for substantive work, existing architecture, data integrity, migration safety, security boundaries, deterministic tests, rollback/recoverability, clean Git history, focused verification, and human approval for architectural changes.

Remove redundant ceremony, not engineering quality.

## Kairo V1 execution cadence

For Tasks 5, 6, and 7: focused implementation → focused tests → update `progress.md` → commit if permitted → stop.

After Tasks 5–7, perform one independent review only if warranted, remediate concrete findings, and run focused verification. Continue with grouped reviews for later tasks; never automatically review every task.

## Immediate continuation rule

Resume Kairo from the existing preserved worktree. Do not restart Tasks 1–4. For any new task, determine the smallest remaining correct scope and obtain Robert's approval before an expensive action. This Lean-Mode Override remains active unless Robert explicitly changes it.
