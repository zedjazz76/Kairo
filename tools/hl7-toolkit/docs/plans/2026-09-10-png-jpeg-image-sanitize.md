# PNG/JPEG Image Sanitize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local-only Quick Sanitize workflow that produces a newly encoded, metadata-verified PNG/JPEG copy with analyst-reviewed opaque pixel redactions, then package it as Kairo HL7 Toolkit v0.7.3 Workstation Runtime Build 2.

**Architecture:** Pure JavaScript modules separate bounded PNG/JPEG structure inspection, session state, canvas-based raster encoding, output verification, and DOM orchestration. Production decoding and encoding use browser-native APIs; tests inject a deterministic raster adapter and exercise the actual UI in a browser/package. DICOM fails closed and the .NET helper receives no patient-bearing image API.

**Tech Stack:** Browser ES modules, Canvas 2D, Web Crypto SHA-256, Node.js built-in test runner for development tests, existing self-contained .NET win-x64 release pipeline.

**Spec:** `tools/hl7-toolkit/docs/specs/2026-09-10-image-sanitize-design.md`

## Global Constraints

- Implement PNG/JPEG Image Sanitize only; DICOM sanitization and OCR are out of scope.
- Process exactly one explicitly selected file in browser memory; no network calls, directory scanning, browser storage, logs, or history writes.
- Never obtain a writable handle to or overwrite the source.
- Output comes from a fresh pixel encoding and contains only allowlisted structural/color data.
- Redactions are solid opaque rectangles flattened into stored pixels.
- Export requires current output revalidation, baked-pixel verification, unchanged source SHA-256, and explicit pixel review.
- Use exactly the assurance concepts in the approved spec and never claim PHI-free, certain de-identification, or safe-to-share status.
- Preserve the existing HL7/text Quick Sanitize behavior.
- Preserve the no-PowerShell, no-admin, no-installer, no-external-runtime workstation model.
- Feature version remains 0.7.3; package identity becomes Workstation Runtime Build 2; Build 1 is immutable.
- Do not commit implementation or package changes before real Windows manual acceptance.

---

### Task 1: Bounded image structure inspection

**Files:**
- Create: `tools/hl7-toolkit/hl7-toolkit/app/scripts/image-format.mjs`
- Create: `tools/hl7-toolkit/tests/hl7-toolkit/image-format.test.mjs`

**Interfaces:**
- Produces `inspectImageBytes(bytes: Uint8Array): ImageInspection` where `ImageInspection` is `{format:'png'|'jpeg', width:number, height:number, metadata:{status:'present'|'absent'|'needs-review', categories:string[], count:number}}`.
- Produces `verifySanitizedImageBytes(bytes: Uint8Array, expectedFormat:'png'|'jpeg'): {format,width,height}`; throws stable non-PHI codes for forbidden chunks/markers, trailing payload, malformed structure, or format mismatch.

- [ ] **Step 1: Write failing signature, bounds, metadata, and verification tests**

Use constructed synthetic PNG chunks and JPEG segments to assert PNG/JPEG dimensions; EXIF/XMP/IPTC/COM/text detection by category/count only; DICOM `DICM`, GIF, malformed lengths, trailing payload, and unsupported types throw stable codes; clean allowlisted output passes; forbidden output metadata fails.

- [ ] **Step 2: Run RED**

Run: `node --test tests/hl7-toolkit/image-format.test.mjs` from `tools/hl7-toolkit`.
Expected: FAIL because `image-format.mjs` does not exist.

- [ ] **Step 3: Implement the minimum bounded parsers**

Parse PNG signature, IHDR, ordered bounded chunks through IEND, CRC field presence, dimensions, and ancillary metadata names without decoding values. Parse JPEG SOI, bounded marker lengths, SOF dimensions, APP1 EXIF/XMP, APP13, COM, other APP markers, scan data byte stuffing/restart markers, and EOI. Reject arithmetic overflow, invalid ordering/lengths, zero dimensions, trailing bytes, unsupported signatures, and DICOM signatures. Enforce 50 MiB, 16,384 per axis, and 40 megapixels.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/hl7-toolkit/image-format.test.mjs`.
Expected: all tests pass without console output from production code.

### Task 2: Session model, integrity, and review gates

**Files:**
- Create: `tools/hl7-toolkit/hl7-toolkit/app/scripts/image-sanitize-model.mjs`
- Create: `tools/hl7-toolkit/tests/hl7-toolkit/image-sanitize-model.test.mjs`

**Interfaces:**
- Consumes `inspectImageBytes` and `verifySanitizedImageBytes`.
- Produces `createImageSanitizeSession({cryptoImpl?, maxRedactions?})` with `loadSource`, `addRedaction`, `undo`, `reset`, `setPreview`, `confirmPixelReview`, `assertExportable`, `markExported`, `clear`, and immutable `snapshot()`.
- Redactions use `{x:number,y:number,width:number,height:number}` in integer source pixels.

- [ ] **Step 1: Write failing state and privacy tests**

Assert PNG/JPEG load, original full SHA-256, dimension/metadata projection, normalized/clamped rectangles, multiple regions, 100-region limit, undo, reset, clear/disposal callbacks, stale generation rejection, review invalidation after every output-affecting change, exact assurance strings, export blocking before review/verification, and unchanged re-read source hash.

- [ ] **Step 2: Run RED**

Run: `node --test tests/hl7-toolkit/image-sanitize-model.test.mjs`.
Expected: FAIL because the session module does not exist.

- [ ] **Step 3: Implement the state machine**

Keep raw bytes and full digest private to the closure. Expose only format, dimensions, metadata categories/count, abbreviated digest if needed, rectangles, generation, statuses, and boolean eligibility. Copy all public arrays/objects. `clear()` invokes registered resource disposers and returns to `EMPTY`. Stable errors contain no filename, metadata value, bytes, data URL, object URL, or full digest.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/hl7-toolkit/image-sanitize-model.test.mjs`.
Expected: all model tests pass.

### Task 3: Fresh canvas encoding and baked-pixel verification

**Files:**
- Create: `tools/hl7-toolkit/hl7-toolkit/app/scripts/image-raster.mjs`
- Create: `tools/hl7-toolkit/tests/hl7-toolkit/image-raster.test.mjs`

**Interfaces:**
- Produces `createBrowserRasterAdapter(environment)` with `decode(bytes,type)`, `render(decoded,rectangles,{format,quality,background})`, `verify(bytes,{format,width,height,rectangles,fill})`, and `dispose(resource)`.
- Produces `sanitizeRaster({sourceBytes, inspection, rectangles, outputFormat, adapter}): Promise<{bytes:Uint8Array,blob:Blob,width,height}>`.

- [ ] **Step 1: Write failing adapter-contract tests**

Inject a deterministic in-memory adapter and assert fresh rendering uses decoded pixels only, every rectangle is sent as opaque black source-pixel coordinates, multiple regions survive re-decode sampling, output structure verification runs before success, dimension mismatch fails, and no overlay/redaction object is returned.

- [ ] **Step 2: Run RED**

Run: `node --test tests/hl7-toolkit/image-raster.test.mjs`.
Expected: FAIL because `image-raster.mjs` does not exist.

- [ ] **Step 3: Implement orchestration and browser adapter**

Use `createImageBitmap` or an `Image` object backed by a session-only object URL, a fresh offscreen/document canvas, Canvas 2D `drawImage` and opaque `fillRect`, and `convertToBlob`/`toBlob`. Normalize EXIF orientation through decoded display pixels. PNG output preserves alpha; JPEG fills a reviewed opaque background and uses one documented fixed quality. Reinspect encoded bytes, reopen them, require matching dimensions, and sample the interior of every rectangle for opaque black pixels with a small JPEG tolerance. Release temporary bitmaps, canvases, and URLs on all paths.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/hl7-toolkit/image-raster.test.mjs`.
Expected: all raster-contract tests pass.

### Task 4: Quick Sanitize selector and image workflow UI

**Files:**
- Create: `tools/hl7-toolkit/hl7-toolkit/app/scripts/image-sanitize-ui.mjs`
- Create: `tools/hl7-toolkit/tests/hl7-toolkit/image-sanitize-ui.test.mjs`
- Modify: `tools/hl7-toolkit/hl7-toolkit/app/index.html`
- Modify: `tools/hl7-toolkit/hl7-toolkit/app/styles/app.css`
- Modify: `tools/hl7-toolkit/hl7-toolkit/app/scripts/app.mjs`

**Interfaces:**
- Consumes the session and browser raster adapter.
- Produces `mountImageSanitize(root,{environment?,download?})` returning `{open,clear,getSnapshot}`.
- Existing text sanitizer control IDs and handlers remain unchanged.

- [ ] **Step 1: Write failing UI and text-regression tests**

Assert the global dialog first shows two designer cards, exact names, description, synthetic example, Quick Guide, and Open Tool button; opening text reveals the unchanged controls; opening image reveals one-file PNG/JPEG selector, source canvas, metadata/pixel/redaction statuses, add-by-pointer and keyboard coordinate controls, undo/reset/clear, output format, preview, review checkbox, and save. Assert DICOM selection reports unsupported, file-controlled text uses `textContent`, stale work cannot update the DOM, and neither UI code nor an image interaction invokes fetch/XHR/WebSocket/beacon, storage, history API, or console.

- [ ] **Step 2: Run RED**

Run: `node --test tests/hl7-toolkit/image-sanitize-ui.test.mjs tests/hl7-toolkit/ui-contract.test.mjs`.
Expected: FAIL on missing image selector/workflow.

- [ ] **Step 3: Implement the minimum selector and controller**

Retain one global dialog and current Kairo card/button language. Add selector, text view, image view, and Quick Guide content. Wire selection to signature inspection before decode, canvas pointer rectangle drawing, numeric keyboard-accessible rectangle entry, preview generation, exact status text, explicit whole-image review, sanitized filename generation, source hash re-read, verified Blob download via a temporary anchor, and complete cleanup. Prevent overwrite by never requesting a writable source handle. Keep the warning: “Review complete does not certify that the image is PHI-free, de-identified with certainty, or safe to share. Apply your organization’s privacy and disclosure policy.”

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/hl7-toolkit/image-sanitize-ui.test.mjs tests/hl7-toolkit/ui-contract.test.mjs tests/hl7-toolkit/sanitizer.test.mjs`.
Expected: all tests pass and existing text sanitization remains unchanged.

### Task 5: Actual-browser raster acceptance harness

**Files:**
- Create: `tools/hl7-toolkit/tests/hl7-toolkit/helpers/image-sanitize-browser-check.mjs`
- Create: `tools/hl7-toolkit/tests/hl7-toolkit/fixtures/images/README.md`
- Create during tests only: synthetic PNG/JPEG fixture files in a temporary directory; do not check image binaries into the package.

**Interfaces:**
- Uses Chrome DevTools Protocol like the existing DICOM browser check.
- Accepts debug URL and launched Kairo URL; performs no external network access.

- [ ] **Step 1: Write the browser check and observe RED against the pre-integration UI**

The harness generates tiny synthetic PNG/JPEG inputs locally, injects them through the real file control, draws two rectangles, previews, confirms review, intercepts the download bytes in page memory, reopens the output, verifies forbidden metadata absence and rectangle pixels, checks unchanged input SHA-256, tests undo/reset, and injects a synthetic DICOM signature for fail-closed rejection.

- [ ] **Step 2: Run RED or document the environment gate**

Run against an available Chromium and current helper. If Chromium/.NET cannot run in the development environment, record the exact missing prerequisite and retain the harness for Windows packaged-runtime execution; do not claim browser execution.

- [ ] **Step 3: Make only integration corrections exposed by the real browser**

Correct coordinate mapping, Blob handling, decoder lifetime, status invalidation, or browser encoder allowlisting only when a focused failing test reproduces the issue first.

- [ ] **Step 4: Run GREEN where supported**

Expected: real PNG and JPEG workflows pass in the browser with no external requests and DICOM is rejected.

### Task 6: Regression and syntax verification

**Files:**
- Modify only if a focused regression proves an in-scope compatibility defect.

**Interfaces:** none.

- [ ] **Step 1: Run focused suites**

Run image-format, model, raster, UI, sanitizer, UI-contract, workspace-navigation, segment-help, DICOM inspection, parser, and validator tests.

- [ ] **Step 2: Run the complete JavaScript suite**

Run: `node --test tests/hl7-toolkit/*.test.mjs` from `tools/hl7-toolkit`.

- [ ] **Step 3: Run syntax checks**

Run `node --check` for every modified/new `.mjs` production and test file.

- [ ] **Step 4: Run privacy source audit**

Search image modules for `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `localStorage`, `sessionStorage`, `indexedDB`, `console`, `innerHTML`, writable file APIs, and history persistence. Any occurrence must be absent or an explicit test assertion/helper with no production invocation.

### Task 7: Increment runtime identity and release pipeline to Build 2

**Files:**
- Modify: `tools/hl7-toolkit/runtime/Kairo.Helper/Kairo.Helper.csproj`
- Modify: `tools/hl7-toolkit/runtime/Kairo.Helper/RuntimeIdentity.cs`
- Modify: `tools/hl7-toolkit/runtime/Kairo.Helper.Tests/RuntimeIdentityTests.cs`
- Modify: `tools/hl7-toolkit/runtime/Kairo.Helper.Tests/Packaging/PackageTests.cs`
- Modify: `tools/hl7-toolkit/build-workstation-runtime.sh`
- Create: `tools/hl7-toolkit/docs/releases/2026-09-10-workstation-runtime-build-2.md`

**Interfaces:**
- Produces runtime identity `0.7.3-workstation.2`, assembly/file version `0.7.3.2`, display name `Kairo HL7 Toolkit v0.7.3 - Workstation Runtime Build 2`.
- Produces immutable `dist/Kairo-HL7-Toolkit-v0.7.3-win2/`, `.zip`, and `.zip.sha256` without touching win1.

- [ ] **Step 1: Write failing runtime/package identity tests**

Expect RuntimeBuild 2, Build 2 display/version strings, win2 package shape, presence of image sanitizer assets/UI labels, absence of DICOM sanitizer claims and all script/source/debug/test/image fixtures, empty `data/runtime`, and manifest hashes matching every packaged file.

- [ ] **Step 2: Run RED**

Run the .NET RuntimeIdentity test when the SDK is available and the relevant static package assertions. Expected: FAIL because identity and build script still say Build 1.

- [ ] **Step 3: Implement Build 2 identity and non-destructive packaging**

Change only runtime-build fields, never feature version. Make the script target win2 exclusively and refuse to remove/overwrite win1. Because implementation is intentionally uncommitted pending manual acceptance, record `sourceBaseCommit`, a deterministic SHA-256 inventory of packaged source/assets, and `candidateStatus: manual-verification` accurately rather than claiming the dirty tree is a committed source revision. Release notes identify PNG/JPEG Image Sanitize, DICOM exclusion, assurance limits, and unsigned SmartScreen behavior without bypass advice.

- [ ] **Step 4: Run GREEN**

Run .NET tests when the SDK is available. Run shell syntax and release-script contract tests. Expected: Build 2 identity passes and Build 1 paths/hashes are unchanged.

### Task 8: Build and audit the actual win2 candidate

**Files:**
- Create through the release pipeline only: `tools/hl7-toolkit/dist/Kairo-HL7-Toolkit-v0.7.3-win2/`
- Create through the release pipeline only: `tools/hl7-toolkit/dist/Kairo-HL7-Toolkit-v0.7.3-win2.zip`
- Create through the release pipeline only: `tools/hl7-toolkit/dist/Kairo-HL7-Toolkit-v0.7.3-win2.zip.sha256`

**Interfaces:** final manual-verification candidate only; no commit or push.

- [ ] **Step 1: Capture immutable win1 hashes**

Hash the win1 folder manifest, ZIP, and checksum before building; compare after building.

- [ ] **Step 2: Build win2 with the accepted pipeline**

Run `./build-workstation-runtime.sh`. If the local .NET SDK is unavailable, use the project's already approved development-only SDK path. Do not download any workstation dependency.

- [ ] **Step 3: Verify the package itself**

Verify ZIP checksum, clean extraction, every manifest hash, Build 2 identity, included image sanitizer modules/UI, DICOM rejection contract, empty runtime data, no `.ps1/.psm1/.cmd/.cs/.pdb`, no tests/docs/fixtures/source images, no developer paths, no credentials, and no PHI canaries.

- [ ] **Step 4: Run packaged helper tests where the host permits**

On Windows, launch packaged `Kairo.Helper.exe`, verify browser opening and loopback-only listener, and run the actual-browser image check. On non-Windows, run PE/package/static/API regression tests and report Windows launch/manual verification as the required next gate rather than claiming it passed.

- [ ] **Step 5: Final repository checks**

Run `git diff --check`, audit `git status`, confirm only approved implementation/plan/release candidate files plus preserved pre-existing work are present, and stop without committing or pushing.
