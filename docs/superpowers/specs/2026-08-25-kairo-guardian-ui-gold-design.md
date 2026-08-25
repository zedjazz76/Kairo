# Kairo Guardian UI Gold Design

**Status:** Approved for implementation  
**Date:** 2026-08-25  
**Baseline:** `49cbb7c59869d560005866f1b7b3953bd88e19a8`  
**Approval:** Robert's Guardian UI Gold Pass direction is the approval for this design.

## Source of truth

**The authoritative visual source is
`docs/branding/kairo-guardian-brand-identity-board.png`.**

It is immutable. Its Guardian, KAIRO lockup, splash composition, app-icon
variants, palette, and visual balance are the product target, not loose
inspiration. Derived assets use exact, non-destructive crops of this board:

- hero Guardian: `x=70..470`, `y=100..615`;
- square icon source: `x=960..1110`, `y=78..229` (light) and
  `x=1155..1305`, `y=78..229` (dark);
- circular emblem source: `x=1355..1503`, `y=78..228`;
- logo/icon reference strip: `x=35..535`, `y=687..801`;
- splash reference: `x=970..1500`, `y=675..955`.

The board was validated as a decodable 1536×1024 RGBA PNG at the baseline.
No Guardian artwork is redrawn, generated, stretched, or substituted.

`docs/branding/kairo-guardian-ui-layout-board.png` is the coequal immutable
layout source: it controls Home / Assistant, Trace Workflow, and Knowledge /
Memory composition, spacing, density, action placement, and bottom navigation.
Where the boards differ, this layout board controls screen composition; the
identity board controls Guardian artwork, materials, wordmark, palette, and
type.

## Product expression

Kairo is a quiet, premium clinical-systems intelligence product: protective,
precise, spacious, and evidence-first. Dark Guardian identity moments frame
authentication, Deep Analyze, and selected branded navigation. Cool near-white
working surfaces support evidence, capture, projects, systems, and review.
Material is a Compose implementation detail, never the visual language.

## Immutable palette tokens

| Token | Hex | Role |
| --- | --- | --- |
| Guardian White | `#F7FAFC` | principal working canvas and splash base |
| Frost Silver | `#E6ECF1` | raised working material |
| Steel Mist | `#B8C7D3` | borders, muted labels, dividers |
| Clinical Blue | `#6CA0B7` | restrained information hierarchy |
| Guardian Cyan | `#22D3C5` | focused action, halo, active state |
| Guardian Black | `#0E141B` | identity planes and dark navigation |

Derived alpha states are allowed only for elevation, separators, pressed or
disabled state, scrims, and restrained halo gradients. Purple, warm neutrals,
orange, random Material primaries, rainbow chips, and neon effects are out of
scope.

## Typography and wordmark

Space Grotesk is the application family, using OFL-licensed static Regular,
Medium, and SemiBold files. SemiBold is reserved for wordmark, headings,
important values, and primary actions. The reusable KAIRO wordmark is uppercase
with the board's generous geometric tracking and small cyan underline; it is
not a default text heading. Body text remains readable at Android font scaling.

## Components and Android composition

`kairo.android.theme` owns Guardian palette, typography, spacing, corner,
border, and elevation tokens. `kairo.android.guardian` provides wordmark,
artwork, surfaces, cards, buttons, fields, section headers, state/scope chips,
navigation, empty/loading states, and evidence rows. `KairoShell` retains its
existing state, callbacks, destinations, evidence links, local Quick path,
Live Deep Analyze provider, and memory approval semantics while using those
components.

The Android shell is deliberately a light clinical canvas with a dark compact
top/navigation treatment. Unlock is a full Guardian Black identity scene. Deep
Analyze is the one dark flagship work surface, with a restrained cyan halo and
explicit live/unavailable/fallback language. Evidence and source metadata stay
high-contrast on light surfaces. State and scope are conveyed by text, shape,
border, and muted tonal treatment in addition to color.

## Application assets and Android platform presentation

Exact board crops are stored as app-specific drawable assets, with transparent
or board-consistent backgrounds only where the crop permits it. Android uses a
proper adaptive icon foreground/background plus round and legacy resources.
The platform splash uses Android 12's SplashScreen API with Guardian White,
then transitions into a branded Compose splash/identity composition instead of
delaying the platform splash. The app title remains Kairo.

## Surface requirements

- Home answers what Kairo knows, needs attention, and what can be done using
  only existing facts, inbox, source, connection, and route data.
- Copilot distinguishes Quick/local from Deep Analyze and exposes evidence,
  scope, state, and local/offline availability without provider internals.
- Deep Analyze highlights analysis state, evidence-backed output, next action,
  model enrichment when present, and deterministic fallback when unavailable.
- Sources, Memory Inbox, Projects, Capture, Systems, Workflows, and Knowledge
  use the same card and metadata grammar; no data or persistence behavior
  changes.
- Offline, unavailable, empty, and loading states receive deliberate Guardian
  presentation.

## Desktop parity

Desktop keeps its paired encrypted command seam and Task 13 split-view
strengths. CSS creates the same type, palette, dark shell, clinical working
surfaces, wordmark, emblem, evidence, and status language at workstation
scale. It adds no browser key, persistence, unpaired command path, or backend
behavior.

## Accessibility, validation, and security

The implementation maintains accessible contrast, touch targets, semantic
labels, keyboard focus, and large-text resilience. Existing Android and
desktop functional behavior remains covered. A fresh APK is installed on the
Samsung device, representative screenshots are compared against the board,
then at least one concrete visual refinement pass is performed. Full Android,
desktop, Task 15, secret/PHI, relay retention, and diff checks gate closure.
