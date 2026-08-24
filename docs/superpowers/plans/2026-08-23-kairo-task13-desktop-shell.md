# Kairo Task 13 Desktop Shell Implementation Plan

> **For agentic workers:** Execute this plan directly in lean mode. Do not use subagents unless Robert explicitly approves them.

**Goal:** Establish the first real browser UI for Kairo with Capture as the primary workspace and persistent Copilot/evidence visibility on large screens.

**Architecture:** Keep `DesktopWorkspace` as the single desktop navigation/evidence state spine and `CaptureBatch` as the capture staging model. React components render those models; they do not create a parallel knowledge or capture store. The first slice uses server-rendered React tests for deterministic UI contracts, then later Task 13 slices add browser interaction and Playwright E2E.

**Tech Stack:** React, React DOM, TypeScript, Vite, Node test runner.

**Spec:** `docs/superpowers/plans/2026-08-20-kairo-v1-implementation.md` Task 13.

## Global Constraints

- Browser remains a client of the authoritative Android Core.
- Do not create a second writable knowledge graph or durable browser source store.
- Preserve the existing paired tunnel and `CoreCommandV1` contracts.
- Capture state retains metadata/source references only; raw file bytes are not durable browser state.
- Copilot remains visible when the evidence pane opens on large screens.
- Use the existing `DesktopWorkspace` and `CaptureBatch` models rather than duplicating state in React.

---

### Task 1: First React desktop shell

**Files:**
- Modify: `apps/desktop-web/package.json`
- Create: `apps/desktop-web/src/app/App.tsx`
- Create: `apps/desktop-web/src/features/capture/CaptureWorkspace.tsx`
- Create: `apps/desktop-web/src/features/copilot/CopilotWorkspace.tsx`
- Create: `apps/desktop-web/src/features/evidence/EvidencePane.tsx`
- Test: `apps/desktop-web/src/app/App.test.tsx`

**Interfaces:**
- Consumes: `DesktopWorkspace`, `CaptureBatch`.
- Produces: React shell with Capture primary content, persistent Copilot rail, and conditional Evidence pane.

- [ ] Add React/Vite/TypeScript package configuration for the desktop package.
- [ ] Write a failing server-render UI test for Capture + Copilot + evidence split view.
- [ ] Run the focused UI test and confirm failure because production components are missing.
- [ ] Implement the minimum React shell and components.
- [ ] Run focused UI tests plus existing desktop unit tests.
- [ ] Commit and stop for verification.
