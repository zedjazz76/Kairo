# Kairo Global Workspace Selector and Tool Navigation

**Status:** Implemented and accepted through the real Windows Kairo UI on September 7, 2026
**Classification:** Architectural UI work  
**Applies to:** Existing Kairo Stage 1 through Checkpoint 7.2 user interface  
**Depends on:** The approved Checkpoint 7.2 specification and its current uncommitted implementation

## 1. Objective

Make Kairo's multi-tool workspaces feel like a coherent clinical-systems toolbox. A workspace containing more than one independent tool opens on a selector page. Each selector uses the same cards, designer buttons, in-Kairo quick-guide dialog, tool breadcrumb, and back action. Opening a card reveals the existing tool rather than duplicating or reimplementing it.

This change is presentation and navigation architecture only. It must preserve all Stage 1 through Checkpoint 7.2 behavior, state, network operations, parsing, evidence models, persistence, and privacy boundaries.

## 2. Current Workspace and Tool Inventory

| Current top-level workspace/action | Existing tools or workflow parts | Final navigation treatment |
| --- | --- | --- |
| Home | File intake, pasted-message intake, synthetic sample | Direct page. These are entry methods for one intake workflow. |
| Inspect & edit | HL7 message catalog, raw/tree editor, field and segment editing, findings | Becomes **Inspect** selector. Existing controls form the **HL7 Message Inspector** tool. |
| Compare | Exact and semantic comparison of two loaded HL7 messages | Direct **Compare** page. One workflow. |
| Validate | Baseline/local-profile validation of the selected HL7 message | Direct **Validate** page. One workflow. |
| DICOM | DICOM Part 10 metadata inspection and its redacted troubleshooting copy | Moves under the **Inspect** selector as **DICOM File Inspector**. Redacted copy remains part of this tool. The redundant top-level DICOM navigation item is removed. |
| Diagnostics | Endpoint profiles/baselines/evidence, DICOM TCP/C-ECHO, MWL C-FIND, ORM-to-MWL comparison, HTTP/TLS, HL7/MLLP | Becomes a selector with six tool cards and isolated tool views. |
| Case | Case creation, evidence note/timeline, evidence summary, technical handoff | Direct **Case** page. These are sequential parts of one case workflow, not independent tools. |
| Send | Destination profile, guarded review/preflight, one-message MLLP send, ACK display | Direct **Send** page. These are parts of one guarded send workflow. |
| History | Search, inspect, export, and delete sanitized history | Direct **History** page. One workflow. |
| Quick Sanitize | Existing globally available sanitization dialog | Remains a global action/dialog and does not become a selector workspace. |

No new product area is created. Existing top-level names remain except that **Inspect & edit** becomes **Inspect** and absorbs the existing DICOM inspector. Direct navigation to the former DICOM workspace is replaced by opening **Inspect → DICOM File Inspector** through the shared router; no DICOM functionality is removed.

## 3. Approaches Considered

### 3.1 Approved recommendation: reusable in-memory workspace router

A small browser-only navigation controller coordinates workspace landing pages, tool views, breadcrumbs, back actions, and the shared guide dialog. Existing feature controllers continue to bind to their existing DOM nodes once. Tool containers are shown or hidden without remounting, so active in-session state survives Back and reopen operations.

This approach provides one consistent interaction contract, avoids coupling feature controllers to navigation, and does not put tool state in URLs.

### 3.2 Rejected: URL/hash sub-routes

Encoding workspace/tool routes in the URL would complicate the existing session-token hash, create more browser-history behavior than this checkpoint needs, and increase the risk of exposing navigation-derived state. Deep linking is not required.

### 3.3 Rejected: bespoke selector logic per workspace

Independent Inspect and Diagnostics implementations would minimize shared code but duplicate focus, keyboard, guide, and state behavior. That conflicts with the global-consistency requirement and makes later fixes harder.

## 4. Architecture

### 4.1 Workspace navigation controller

Add one narrow browser-only navigation module responsible for:

- switching existing top-level workspaces;
- showing a multi-tool workspace's landing view or exactly one tool view;
- rendering/updating breadcrumb and Back labels from a static registry;
- opening and closing one shared quick-guide dialog;
- restoring accessible focus after each navigation action; and
- preserving the selected tool identity only in browser memory for the active session.

The controller does not own protocol, parser, comparison, case, persistence, or clinical evidence state. It does not invoke tool actions, inspect field values, remount feature controllers, write history, perform network requests, or automatically run any tool.

The existing workbench workspace switch delegates presentation to this controller through a narrow function such as `showWorkspace(workspaceId)`. Feature modules require no access to router internals.

### 4.2 Static tool registry

A static, nonclinical registry defines only display/navigation metadata:

- workspace ID and workspace label;
- tool ID and tool label;
- concise description;
- synthetic, non-PHI example;
- target container ID;
- guide sections: purpose, example, three to five steps, common-result interpretation, and one troubleshooting tip.

The registry contains no endpoint values, message content, query criteria, results, patient identifiers, accessions, profile data, or other runtime evidence. Tool labels and guide copy are rendered with text-safe DOM APIs.

### 4.3 Existing tool ownership

Each existing controller remains the sole owner of its behavior and state. The router changes only container visibility and focus. Existing tools mount once during application startup whether initially visible or not. There is no duplicated form, result panel, or event binding.

The Diagnostics tool boundaries are:

1. **Endpoint Profiles & Baselines** — the existing profile form, baseline controls, and conservative evidence-summary/case-attachment controls.
2. **DICOM Connectivity** — the existing TCP/DICOM form and DNS → TCP → association → C-ECHO result panel.
3. **Modality Worklist** — the complete existing MWL form, layered results, results table, and selected-item inspector.
4. **ORM ↔ MWL Comparison** — the complete Checkpoint 7.2 comparison UI, concept summaries, and guidance. It continues reading the current in-memory HL7 and MWL sources through its approved interfaces.
5. **HTTP / TLS** — the existing HTTP/TLS form and layered result panel.
6. **HL7 / MLLP** — the existing MLLP form and layered result/ACK panel.

Profiles remain usable by the same consumers. Hiding their view does not unload or reset them. The ORM ↔ MWL tool remains under Diagnostics because its approved workflow depends on active MWL evidence; opening it never automatically selects or compares evidence.

## 5. Navigation State and Lifecycle

Navigation uses the following presentation states:

- `DIRECT_WORKSPACE(workspaceId)` for Home, Compare, Validate, Case, Send, and History;
- `WORKSPACE_LANDING(workspaceId)` for Inspect and Diagnostics selectors;
- `TOOL_OPEN(workspaceId, toolId)` for one selected tool;
- `GUIDE_OPEN(workspaceId, toolId, returnFocusTarget)` as a temporary overlay on either a landing or tool view.

Transitions are explicit:

- Sidebar selection of a direct workspace shows that direct workflow.
- Sidebar selection of Inspect or Diagnostics always opens its landing page.
- **Open Tool →** moves from landing to that tool view.
- **← Back to Workspace** moves from the tool view to its landing page.
- **? Quick Guide** opens the shared dialog without opening or running the tool.
- Closing the guide returns focus to the button that opened it.
- Switching top-level workspaces closes any guide and removes the prior tool view from display.
- Ending/reloading the session resets navigation presentation state.

Back and reopen preserve existing in-session tool inputs and results because navigation does not clear, reconstruct, or remount tool DOM. Existing feature-specific invalidation rules remain authoritative. For example, MWL clearing still invalidates the selected result and Checkpoint 7.2 target; merely navigating away does not.

No tool is automatically selected or opened when entering a selector workspace. No tool action, query, comparison, validation, send, history refresh beyond existing behavior, or diagnostic runs as a consequence of selector navigation.

## 6. Selector and Card Design

Each selector page has its existing workspace heading followed by a responsive card grid. Every card has the same semantic order:

1. optional restrained decorative tool icon;
2. tool name;
3. one-sentence description;
4. an **Example** label and one concrete synthetic/non-PHI scenario;
5. secondary **? Quick Guide** button; and
6. visually dominant primary **Open Tool →** button.

Cards use consistent internal layout and equal-height behavior within a row. The action area aligns to the bottom so labels do not create ragged button positions. Desktop uses three columns when space allows, two at intermediate widths, and one on narrow windows. Buttons have a practical minimum target size and may expand to card width on narrow screens. Labels must not wrap awkwardly; the layout may stack actions before abbreviating text.

Hover may apply a small elevation and border change. Focus uses a clear outline independent of color. Active state gives slight press feedback. Disabled state, if ever needed, uses opacity plus cursor/text treatment rather than color alone. All transitions are short and restrained. Under `prefers-reduced-motion: reduce`, transforms and nonessential transitions are disabled.

The primary button uses Kairo's filled accent treatment, restrained border/shadow, readable weight, rounded corners, generous horizontal padding, and a decorative arrow hidden from assistive technology. The secondary guide button uses a lighter surface/outline treatment with the question mark decorative. Neither relies on default browser styling or neon/large-gradient effects. Existing Kairo dark tokens are used; if a light theme is added later, semantic color variables—not tool-specific overrides—must provide readable contrast.

## 7. Tool View, Breadcrumb, and Back Action

An open tool displays:

```text
Workspace
> Tool Name

← Back to Workspace
```

The breadcrumb identifies the current location; the Back action is a real keyboard-accessible button using the shared secondary/navigation style. It returns to the selector without clearing tool state. Only the selected tool's container is visible; sibling tool controls and results are hidden.

On Open, focus moves to the tool view heading, not directly into a form field and never to a destructive or network action. On Back, focus moves to the selector heading or the originating card's Open button when safely available. Screen readers receive the new context through focus and headings rather than a verbose live-region announcement.

## 8. Quick Guide Dialog

Kairo uses one reusable native dialog pattern, consistent with its existing dialogs. The dialog title is the tool name and every guide contains:

- **What this tool does** — one short paragraph;
- **Example** — the same synthetic/non-PHI scenario shown on the card;
- **How to use it** — three to five ordered steps;
- **How to interpret common results** — concise qualified guidance that respects the underlying tool's established claims;
- **Troubleshooting tip** — one bounded practical tip; and
- **Close** control.

Guide content is static and concise. It does not fetch external documentation, execute tools, expose live values, duplicate full product documentation, introduce new clinical claims, or persist which guide was viewed. Escape and the visible Close button close the dialog. Focus is trapped by the native dialog behavior and restored to the invoking guide button.

## 9. Required Card Content

### 9.1 Inspect

**HL7 Message Inspector**  
Description: Inspect and edit one loaded HL7 message with raw and structured views.  
Example: “An ORM message contains an unexpected procedure value and the analyst needs its exact OBR path.”

**DICOM File Inspector**  
Description: Inspect metadata from one local DICOM Part 10 file without rendering pixels.  
Example: “A synthetic CT object reports an unexpected SOP Class or Transfer Syntax.”

### 9.2 Diagnostics

**Endpoint Profiles & Baselines**  
Description: Manage nonclinical endpoint profiles and compare current technical evidence with a known-good result.  
Example: “A test PACS endpoint changed ports and its current connectivity differs from last week's baseline.”

**DICOM Connectivity**  
Description: Test DNS, TCP, DICOM association, and C-ECHO for one authorized endpoint.  
Example: “A modality can resolve the PACS host but Verification is rejected for the configured Called AE.”

**Modality Worklist**  
Description: Query an authorized MWL SCP and inspect returned scheduled procedures.  
Example: “An MRI order exists in the RIS but does not appear on the modality worklist.”

**ORM ↔ MWL Comparison**  
Description: Compare one explicitly selected ORM order group with a selected MWL item or successful zero-match query context.  
Example: “The upstream ORM says MR while the selected worklist item reports CT.”

**HTTP / TLS**  
Description: Inspect DNS, TCP, TLS certificate, and HTTP status evidence for one authorized URL.  
Example: “A health endpoint resolves and negotiates TLS but returns an unexpected redirect.”

**HL7 / MLLP**  
Description: Check safe MLLP reachability or send one explicitly requested synthetic HL7 test message.  
Example: “The interface port accepts TCP but the synthetic message receives an application-error ACK.”

The implementation must provide the five required concise guide sections for each listed tool. Guide interpretations must repeat the established conservative boundaries—for example, TCP success is not protocol success, C-ECHO does not prove MWL, a successful zero-match MWL query is not an MWL failure, and an HL7 AA does not prove downstream clinical processing.

## 10. Accessibility and Text Safety

- Cards use headings and ordinary text; card surfaces themselves are not nested interactive controls.
- Every Open and Quick Guide control has an unambiguous accessible name including its tool name, even if visible labels are shared.
- Decorative arrows, question marks, and icons are hidden from assistive technology.
- All navigation is keyboard operable with visible focus.
- DOM order matches visual order.
- Hidden tool containers use the existing `hidden` behavior and are removed from the accessibility tree.
- Guide and registry strings are inserted as text, never remote or runtime HTML.
- Selector examples are synthetic and contain no real endpoints, credentials, PHI, accessions, or patient identifiers.
- Contrast must meet the existing Kairo accessibility standard; state is never indicated by color alone.

## 11. Privacy and Security Boundaries

Navigation state and guide state are ephemeral browser-memory presentation data. They are not stored in local history, profiles, baselines, cases, handoffs, logs, telemetry, URLs, query strings, hashes, DOM IDs, or DOM data attributes derived from clinical values.

Existing tool state retains its current owner and lifecycle. This design does not widen any persistence schema, copy patient-bearing content into cards/guides, log selected tool data, add an API route, or change request authentication. Static tool IDs are nonclinical constants and may appear in markup for routing.

## 12. Error and Edge Behavior

- An unknown workspace/tool ID fails closed to its workspace landing page, or Home if the workspace is unknown. It never opens multiple tool panels.
- A missing target container disables only that card, presents a nontechnical local unavailable label, and performs no tool action. This is a presentation/configuration error, not a protocol failure.
- A tool may open with its existing empty, unavailable, or validation state. The router does not reinterpret it.
- Opening ORM ↔ MWL without selected sources shows the existing explicit-selection state; it does not navigate to or operate MWL automatically.
- The guide remains available even when its underlying tool cannot currently run, because it contains static help only.

## 13. Acceptance Criteria

1. Every current top-level workspace/action is accounted for exactly as listed in Section 2.
2. Inspect opens as a two-card selector for HL7 Message Inspector and DICOM File Inspector.
3. The former top-level DICOM navigation entry is removed; all existing DICOM inspector and redacted-copy behavior remains available under Inspect.
4. Diagnostics opens as a six-card selector containing exactly the tools in Section 4.3.
5. Home, Compare, Validate, Case, Send, and History remain direct single-workflow pages; Quick Sanitize remains the global dialog.
6. Every selector card contains a tool name, one-sentence description, synthetic example, Quick Guide button, and dominant Open button.
7. Cards and actions use one shared component/style contract and form a responsive three/two/one-column grid.
8. Opening a tool shows the workspace/tool breadcrumb, shared Back action, and only that tool's existing controls and directly associated results.
9. Back then reopen preserves existing in-session state unless an existing feature-specific privacy or invalidation rule cleared it.
10. Entering a selector workspace, opening a guide, opening a tool, going Back, or reopening never runs a network request, comparison, send, validation, or other tool action.
11. Every tool has one concise in-Kairo guide with all five required content sections and Close behavior; no guide links externally.
12. Keyboard focus, visible focus states, dialog focus restoration, accessible names, heading order, hidden content, and reduced-motion behavior satisfy Section 10.
13. Tool and guide content uses text-safe rendering and does not add runtime evidence to attributes, IDs, URLs, logs, or persistence.
14. Existing Stage 1 through Checkpoint 7.2 controllers mount once and retain their established behavior.
15. Diagnostics tool separation does not alter shared profile use, baseline/evidence behavior, MWL row/query lifecycle, or ORM/MWL source invalidation.
16. Narrow and desktop layouts remain operable without awkward action-label wrapping or horizontal page overflow caused by selector cards.

## 14. Testing Strategy

Implementation follows targeted TDD and then affected-suite regression checks.

### 14.1 Navigation/controller unit tests

- direct workspace versus selector landing transitions;
- Inspect and Diagnostics exact card inventories;
- Open, Back, top-level switch, unknown route, and session-reset behavior;
- exactly one visible tool container;
- no controller remount and state-preserving hide/show;
- no automatic click/action dispatch during navigation;
- guide open/close, Escape, and invoking-control focus restoration;
- target focus after Open and Back;
- missing-target fail-closed behavior.

### 14.2 Static UI contract tests

- every current workspace is classified;
- former DICOM functionality exists under Inspect and redundant nav is absent;
- required card content and guide sections exist for all eight cards;
- shared classes/components are used rather than workspace-specific variants;
- accessible names, breadcrumb, Back controls, native dialog semantics, and text-safe rendering hooks;
- responsive breakpoints, focus/hover/active/disabled rules, and reduced-motion override;
- no new API route, storage schema, log/telemetry call, or clinical-value-derived navigation attribute.

### 14.3 Existing feature regression suites

Run the affected browser suites for workbench/navigation, DICOM inspector, diagnostics, endpoint profiles/baselines/evidence, MWL, Checkpoint 7.2 comparison, case integration, send, history, validation, and the real-launcher navigation checks already defined by Kairo. Run syntax checks for changed modules and `git diff --check`.

Real Windows manual acceptance must verify mouse and keyboard navigation, guide dialog/focus behavior, responsive narrow layout, state preservation, and successful access to every existing tool. Checkpoint 7.2 remains uncommitted until its required real Windows manual acceptance also passes.

## 15. Non-Regression and Rollback

The presentation layer is additive around existing tool containers. Protocol engines, parser/model modules, API routes, persistence schemas, controller action handlers, and tool-specific lifecycle rules remain unchanged. Tests must demonstrate that selector navigation never invokes those actions.

Rollback consists of removing the shared router/guide/card presentation, restoring the prior top-level DICOM navigation entry, and making existing containers visible under their former workspace layout. Because tool DOM IDs, controller mounting, data models, requests, and persistence remain intact, rollback requires no data migration and loses no stored technical configuration or sanitized history.

## 16. Explicit Exclusions

This design does not:

- add or redesign any protocol engine, parser, validator, comparison model, evidence model, profile, baseline, case, handoff, history, or send behavior;
- create new tools, product areas, dashboards, deep links, favorites, recents, search, role-based navigation, or customizable card ordering;
- automatically choose, run, preload, match, compare, send, retry, refresh, or persist anything;
- place cards around subordinate steps within one coherent workflow;
- add external help links or duplicate full documentation;
- start Checkpoint 7.3, Query/Retrieve, Checkpoints 7.4/7.5, or Stage 8; or
- commit the completed Checkpoint 7.2 implementation before real Windows manual acceptance.

## 17. Final Windows Manual Acceptance

Final manual acceptance passed through the real Windows Kairo UI on September 7, 2026. The accepted workflow verified:

- exactly two Inspect cards and six Diagnostics cards, each with its description, synthetic example, Quick Guide, and designer Open Tool action;
- focused tool views, workspace/tool breadcrumbs, Back navigation, hidden sibling controls, and preserved valid in-session tool state;
- Quick Guides that did not trigger diagnostics, closed with Escape, and restored keyboard focus appropriately;
- usable wide, medium, and narrow responsive layouts without page overflow;
- direct Home, Compare, Validate, Case, Send, and History workflows;
- globally available Quick Sanitize; and
- unchanged Stage 1 through Checkpoint 7.2 behavior and privacy boundaries.
