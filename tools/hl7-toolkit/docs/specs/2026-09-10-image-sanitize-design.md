# Kairo Image Sanitize Design

**Status:** Proposed — awaiting design approval; no implementation authorized
**Classification:** Architectural / Privacy / Clinical Imaging
**Product context:** Kairo HL7 Toolkit v0.7.3 and the accepted no-PowerShell workstation runtime
**Date:** 2026-09-10

## 1. Decision Summary

Kairo will extend the global Quick Sanitize entry point with two distinct choices: **HL7 / Text Sanitize** and **Image Sanitize**. Image Sanitize will be delivered in two separately approved checkpoints because ordinary raster sanitization and DICOM de-identification have materially different correctness and assurance requirements.

The first checkpoint supports one explicitly selected PNG or JPEG file. It runs entirely in the browser session, identifies whether supported source metadata containers are present, decodes the image, lets the analyst draw opaque redaction rectangles, flattens those rectangles into newly encoded pixels, verifies the new encoding, requires explicit review, and downloads a new file. It never writes to, renames, or deletes the source.

DICOM sanitization is a later checkpoint. It will use the DICOM PS3.15 Basic Application Level Confidentiality Profile and selected options through a provenance-controlled action table and a standards-capable DICOM implementation in the self-contained helper. The current browser metadata reader is not a DICOM transformation engine and must not be extended ad hoc for this purpose.

Neither checkpoint may describe an output as “PHI free,” “de-identified with certainty,” or “safe to share.” Metadata processing and visual pixel review remain independent states.

## 2. Existing Architecture and Constraints

### 2.1 Quick Sanitize

Quick Sanitize is currently a global dialog for pasted HL7 or text. Sanitization runs locally in browser memory. Copy is gated by review warnings, automatic history receives only approved sanitized projections, and the UI states that the result is not a de-identification certification.

The entry point will remain global. Opening it first presents two established designer cards rather than silently changing the existing text workflow:

- **HL7 / Text Sanitize** opens the current workflow without changing its sanitizer, provenance, history, or clipboard behavior.
- **Image Sanitize** opens the new raster workflow and its Quick Guide.

### 2.2 Existing image and DICOM capability

Kairo currently accepts one local DICOM Part 10 file in the browser and reads a small allowlist of metadata from Explicit VR Little Endian data. It produces a redacted text summary only. It explicitly does not render pixels or produce a modified DICOM object. The diagnostic and query C# code supports networking protocols, not DICOM image decoding or dataset rewriting.

This existing code is appropriate for inspection but not for confidentiality-profile implementation. It does not provide recursive sequence handling, complete data-element preservation, transfer-syntax transcoding, pixel decoding, private-attribute policy, UID remapping, or standards-conformant output validation.

### 2.3 Workstation boundary

The accepted workstation remains a self-contained Windows x64 folder launched by `Kairo.Helper.exe`. It requires no PowerShell, Administrator rights, UAC, installer, separately installed .NET, Node, Python, Java, WSL, service, registry change, firewall change, or network dependency. New browser assets may ship in that folder. Any future managed dependency must be compiled into and published with the self-contained runtime, reviewed for license and supply-chain impact, and require no workstation installation or download.

## 3. Architectural Options

### 3.1 Recommended: browser-native raster checkpoint, managed DICOM checkpoint later

Use browser `File`, image decoding, Canvas 2D, `Blob`, and download APIs for PNG/JPEG. The browser creates a new raster from decoded pixels; Kairo never edits the source file. A small source-metadata inventory module recognizes relevant JPEG marker segments and PNG ancillary chunks. A separate redaction model stores source-pixel rectangles. Export renders decoded pixels and opaque rectangles onto a fresh offscreen canvas, encodes a new PNG or JPEG, verifies it by reopening it, then offers a download.

Later, implement DICOM de-identification in the .NET helper with a reviewed DICOM library and a versioned PS3.15 action-definition set. This keeps DICOM byte rewriting and validation out of hand-written browser parsing.

Advantages: smallest first checkpoint, no new runtime dependency, no raw-image API transfer, a clear test seam, and a hard assurance boundary around DICOM. Cost: browser encoder behavior must be characterized and output metadata verified; DICOM arrives later.

### 3.2 Alternative: all image processing in the .NET helper

Post the selected raster to a new authenticated loopback API and use a managed imaging library for metadata reading, drawing, and encoding. This centralizes encoding and may improve metadata introspection, but sends full patient-bearing image bytes through a new HTTP route, raises current body limits, adds a package dependency immediately, expands attack surface, and complicates browser preview state. It is not justified for the first raster checkpoint.

### 3.3 Alternative: one cross-format browser engine including DICOM

Add JavaScript DICOM parsing, pixel codecs, dataset rewriting, UID/date policy, and raster processing together. This appears locally cohesive but would make browser code responsible for a broad medical file-format implementation, including compressed transfer syntaxes and nested datasets. It would substantially enlarge the first checkpoint and invite incomplete ad hoc de-identification. It is rejected.

## 4. First Checkpoint: PNG and JPEG

### 4.1 Supported inputs

The checkpoint accepts exactly one user-selected file with a recognized PNG or JPEG signature. Extensions and MIME types are hints only. JPG and JPEG are the same JPEG input class. Animated PNG, multi-image JPEG extensions, and formats other than PNG/JPEG are rejected rather than partially processed.

Initial conservative limits are:

- maximum source size: 50 MiB;
- maximum decoded dimensions: 16,384 pixels on either axis;
- maximum decoded pixel count: 40 megapixels;
- maximum estimated RGBA working surface: 160,000,000 bytes;
- one active source and at most 100 redaction regions.

The file signature and encoded header dimensions are checked before full decode where the format permits. Decode errors, malformed metadata lengths, arithmetic overflow, dimensions outside the limits, unsupported color/animation behavior, or browser allocation failure cause a generic local error and no export.

### 4.2 Session state

An image session has an explicit state machine:

1. `EMPTY`
2. `SOURCE_LOADING`
3. `SOURCE_READY_UNREVIEWED`
4. `EDITING_UNREVIEWED`
5. `PREVIEW_READY_UNREVIEWED`
6. `REVIEW_COMPLETE`
7. `EXPORTED`
8. `FAILED`

Selecting another file, clearing, resetting, undoing after preview, adding or changing a rectangle, or changing export format invalidates the preview and review. Export is enabled only in `REVIEW_COMPLETE`.

The active source bytes, decoded bitmap, canvases, metadata inventory, object URLs, preview bytes, and rectangles live only in browser memory. They are not written to Kairo history, application data, local/session storage, IndexedDB, service-worker caches, console output, URLs, telemetry, or diagnostic logs. Clear, source replacement, dialog close, End Session, or page unload revokes object URLs, releases image resources, sets canvas dimensions to zero, removes DOM references, and drops byte-array references. JavaScript garbage collection timing is not presented as secure memory erasure.

### 4.3 Source metadata inventory

The source scanner is bounded and non-recursive. It reports presence and count—not raw values—for supported metadata containers:

- JPEG APP1 EXIF and XMP;
- JPEG APP13 IPTC/Photoshop resources;
- JPEG COM comments;
- other JPEG APP markers as `other application metadata`;
- PNG `eXIf`, `tEXt`, `zTXt`, and `iTXt` chunks;
- other recognized ancillary chunks as technical ancillary metadata.

Unknown or malformed metadata is reported as `NEEDS REVIEW` or causes rejection when safe bounds cannot be established. Metadata values are not needed for the first checkpoint and are not rendered, copied, or logged. This fulfills the first-checkpoint requirement to show whether metadata exists without increasing exposure of patient identifiers.

### 4.4 Redaction model and interaction

The displayed canvas is a view of decoded pixels. Pointer coordinates are transformed to integer source-pixel coordinates and clamped to the image bounds. The redaction model contains only ordered rectangles `{x, y, width, height}` in source pixels. Rectangles must have positive area.

The analyst may add multiple rectangles, undo the most recent rectangle, or clear all rectangles. Reset removes edits and preview while retaining the selected source; Clear releases the entire source session. The editing view may show selection handles, but those handles are never part of the output model.

Redaction uses a fully opaque solid fill, black by default. No blur, pixelation, transparency, CSS mask, SVG overlay, DICOM overlay, annotation layer, or reversible drawing object is an export mechanism.

### 4.5 Flattening and encoding

Preview and export use the same pure rendering operation:

1. create a new offscreen canvas at decoded source dimensions;
2. paint a deterministic opaque background when exporting JPEG or when a source has transparency that cannot be represented by the chosen output;
3. draw the decoded source pixels with no UI overlays;
4. fill every normalized redaction rectangle directly into the pixel surface;
5. encode that surface as a new PNG or JPEG blob;
6. parse the new blob with the output verifier;
7. decode the blob again and verify its dimensions;
8. sample every redacted rectangle away from its boundary and require the expected opaque fill values;
9. display the verified blob as the flattened preview.

The output contains no separately retained rectangle or annotation object. Any failure in encoding or verification disables review and export.

PNG inputs default to PNG output. JPEG inputs default to JPEG output at a documented fixed quality setting; JPEG is lossy, so the UI warns that non-redacted pixels may change. The analyst may choose PNG output for a JPEG source when lossless re-encoding of the decoded pixels is preferable. An input with transparency cannot be exported to JPEG without an explicit preview of the chosen opaque background.

### 4.6 Metadata removal and verification

Kairo strips source metadata by creating a new encoding solely from the decoded pixel surface, not by copying source chunks or marker segments. The output verifier rejects:

- JPEG EXIF, XMP, IPTC/Photoshop, COM, or unapproved APP payloads;
- PNG `eXIf`, `tEXt`, `zTXt`, or `iTXt` chunks;
- trailing bytes after the valid image end marker/chunk sequence;
- malformed or ambiguous output structures.

Encoder-created structural or color-management data may remain only when it is on an explicit non-identifying allowlist and contains no copied source payload. `METADATA SANITIZED` means the newly encoded file passed this checkpoint's versioned output-metadata policy; it does not mean the file contains literally no non-pixel bytes and does not address visible pixels.

If browser encoder output differs across supported workstation browsers, acceptance must characterize each supported browser. An output that cannot pass the verifier is not downloadable; Kairo does not downgrade the result silently.

### 4.7 Review and output

Before review, Kairo shows:

```text
Metadata: SANITIZED | NOT APPLICABLE | NEEDS REVIEW
Pixel content: NOT REVIEWED
Redactions: <count>
```

The analyst must inspect the flattened preview and explicitly confirm: “I reviewed the complete visible image, including areas outside the redactions.” Confirmation changes only the pixel state to `REVIEWED`. `SANITIZATION REVIEW COMPLETE` appears only when metadata is `SANITIZED` or `NOT APPLICABLE`, pixel content is `REVIEWED`, the preview is current, and output verification passed.

The download name is derived from a sanitized base name and is proposed as `<base>_SANITIZED.png` or `<base>_SANITIZED.jpg`. Path components, control characters, reserved Windows names, trailing dots/spaces, and unsafe characters are removed. Kairo downloads a new blob and never targets the source path. Browsers may ask the user how to handle a name collision; Kairo never requests overwrite and warns the analyst to select a new destination if the source name or path would be reused.

After download, the session remains visible for comparison until Clear or replacement. The downloaded file is not added to history and Kairo does not retain its filesystem path.

### 4.8 Original-integrity evidence

At selection, Kairo computes a SHA-256 digest of the selected source bytes in browser memory. Immediately before export it re-reads the same selected `File` object, recomputes SHA-256, and requires an exact match. The digest is displayed only in abbreviated form if useful and is never logged or persisted. This detects source changes during the session and supports automated proof that the sanitizer did not alter source bytes. Browser file selection itself provides no write capability; Kairo never obtains or requests a writable file handle.

## 5. Pixel PHI Model

Metadata and pixels are two independent privacy domains. Removing metadata never advances pixel review. The analyst must review the whole flattened image even if no redaction is drawn and even when a DICOM object's Burned In Annotation says `NO`.

Potential visible identifiers include patient name, MRN, accession number, birth date, exam date/time, institution, physician/operator names, free-text annotations, faces, and other recognizable anatomy or contextual marks. The first checkpoint supports deliberate manual opaque rectangles only.

OCR or text-region detection is deferred. A future optional local-only assistant may suggest regions, but every suggestion and dismissal must remain subject to analyst review. No detected text can never be interpreted as no PHI. Cloud OCR, silent automatic redaction, certification, and new workstation runtime dependencies are prohibited without a separate approved design.

## 6. DICOM Checkpoint

### 6.1 Standards basis and provenance

The later checkpoint is based on DICOM PS3.15 2026c Annex E, **Attribute Confidentiality Profiles**, specifically the Basic Application Level Confidentiality Profile and, for image pixels, the Clean Pixel Data Option. The profile itself warns that attribute processing does not guarantee removal of all identifying information and does not replace a complete de-identification process. The Clean Pixel Data Option requires identifying information to be removed from stored pixel values; an overlay or shutter is insufficient.

Normative source: `https://dicom.nema.org/medical/dicom/current/output/chtml/part15/chapter_E.html`, including Sections E.2 and E.3.1. Before implementation, Kairo will snapshot the approved edition, source URL, retrieval date, table identifiers, option selection, and a generated normalized action table under version control. It will not use an ad hoc tag blacklist as its primary policy.

### 6.2 Required implementation boundary

DICOM sanitization requires a standards-capable managed DICOM library or an equivalently reviewed internal implementation. The choice is a separate pre-implementation dependency decision covering:

- recursive datasets and sequences;
- explicit and implicit VR parsing;
- supported native and compressed transfer syntaxes;
- pixel-frame decoding and encoding;
- correct VR padding and Part 10 file-meta regeneration;
- SOP-class validity checks;
- private attributes and private creators;
- deterministic UID remapping;
- confidentiality-profile action execution;
- conformance and license evidence.

The preferred shape is an authenticated, bounded loopback helper operation compiled into the self-contained runtime. It receives only the one explicitly selected file, holds working data in memory or a tightly controlled per-operation temporary file when a library demonstrably requires it, returns a new DICOM object, and deletes temporary material on completion and startup recovery. No directory enumeration or background scan is allowed. Request limits and streaming must be redesigned rather than simply raising the existing 16 MiB JSON-body limit.

Until that engine, policy set, transfer-syntax support, and validation suite are separately approved, the UI must label DICOM Image Sanitize as unavailable or later work. The raster checkpoint must reject `.dcm` and DICOM signatures; it must not convert DICOM pixels to PNG and call that DICOM sanitization.

### 6.3 Policy categories

The provenance-controlled action table will implement the selected PS3.15 profile actions rather than a hand-maintained list. Its review must explicitly cover:

- patient name, ID, birth date, and context-sensitive demographics such as sex;
- accession, requested procedure, study/series descriptions, comments, and other free text;
- institution, department, station, device, referring/performing/reading physician, and operator identifiers;
- dates and times under the selected temporal option;
- Study, Series, SOP Instance, Frame of Reference, and referenced UIDs using consistent session-scoped or export-scoped remapping where the profile calls for replacement;
- file-meta identifiers regenerated consistently with the dataset;
- private attributes removed by default, including unknown private values, unless the selected Retain Safe Private Option and a separately approved creator/tag allowlist apply;
- structured content, graphics, overlays, icons, curves, presentation states, and embedded or referenced objects;
- Burned In Annotation, Recognizable Visual Features, Patient Identity Removed, De-identification Method, and related conformance attributes.

UIDs are not all deleted. Identifiers needed to preserve valid internal relationships are replaced through a deterministic mapping scoped to the export operation or explicitly selected batch context. The mapping itself is not persisted by default and must never include source identifiers in logs. Dates are removed or consistently transformed only according to the explicitly selected profile option; no date retention option is implicit.

### 6.4 DICOM pixels and review

Supported DICOM objects must render every relevant frame intended for export. Pixel review is per object and accounts for multi-frame content. Redaction changes stored pixel values themselves. Overlays, shutters, presentation states, and annotations do not satisfy the pixel-redaction requirement. When pixels change, the writer updates attributes required by the standard and selected encoding, including Burned In Annotation as permitted by the completed Clean Pixel Data processing, derivation/de-identification indicators, lossy-compression attributes when applicable, and affected checksums or frame metadata.

`Burned In Annotation = NO` is evidence, not proof. Missing, `YES`, or `NO` never removes the mandatory human visual review. Unsupported frames, photometric interpretations, planar configurations, bit depths, color spaces, compression codecs, encapsulated documents, video, or pixel locations cause a fail-closed unsupported result, not a partial sanitized DICOM export.

### 6.5 DICOM output validity

The output is a new `<base>_SANITIZED.dcm`. Before it becomes downloadable, Kairo must reopen it with an independent read pass and verify:

- valid Part 10 structure and supported SOP class;
- required Type 1/Type 2 attributes after profile actions;
- coherent file-meta and dataset SOP identifiers;
- all references use the same UID mapping;
- prohibited and unknown private attributes are absent;
- expected profile actions were applied recursively;
- all intended frames decode;
- permanent redaction pixels are present;
- the original SHA-256 remains unchanged.

Validation proves conformance to Kairo's selected profile implementation and supported-format contract, not an unconditional de-identification guarantee.

## 7. Assurance Language

The UI uses these exact concepts:

- **METADATA SANITIZED:** the output passed the applicable versioned metadata policy.
- **METADATA NOT APPLICABLE:** no supported source metadata container requiring removal was present and the newly encoded output passed verification.
- **METADATA NEEDS REVIEW:** detection, parsing, policy application, or verification was incomplete; export is blocked.
- **PIXEL CONTENT NOT REVIEWED:** no current human confirmation applies to the current flattened preview.
- **PIXEL CONTENT REVIEWED:** the analyst explicitly reviewed the complete current flattened preview. This is invalidated by every edit or re-encode.
- **SANITIZATION REVIEW COMPLETE:** metadata processing passed and the analyst reviewed the current pixel output. This is a workflow-completion statement only.

Persistent nearby language states: “Review complete does not certify that the image is PHI-free, de-identified with certainty, or safe to share. Apply your organization’s privacy and disclosure policy.”

Kairo must not use green “safe” badges, shields, certification marks, risk scores, or wording that implies automated assurance. Status styling may distinguish blocked, pending, and completed workflow states without implying clinical or legal certification.

## 8. UI Design

The existing Quick Sanitize button opens a selector using the current tool-card pattern:

```text
Quick Sanitize

HL7 / Text Sanitize
Prepare pasted messages or text using the existing patient-PHI rules.
[ ? Quick Guide ] [ Open HL7 / Text Sanitize → ]

Image Sanitize
Remove identifying metadata and redact visible patient information from
screenshots, images, and—after its separate checkpoint—DICOM objects.

Example: A PACS screenshot contains a patient name and MRN in the upper-left
corner and must be sanitized before attaching it to a troubleshooting ticket.
[ ? Quick Guide ] [ Open Image Sanitize → ]
```

The image workflow is compact and staged: Select → Redact → Preview → Review → Save. The source filename is treated as potentially identifying and appears only within the active session UI; it is not logged or copied into history. Metadata inventory, image preview, controls, assurance language, and output status use text-safe DOM APIs. No file-controlled value is inserted with `innerHTML`.

Accessibility requirements include keyboard-operable rectangle creation or an equivalent coordinate-entry mechanism, visible focus, descriptive controls, non-color status cues, zoom that does not alter source coordinates, and an announced review invalidation after edits. Export must not depend on pointer input alone.

## 9. Error Handling and Fail-Closed Rules

Errors use stable non-PHI codes and generic explanations. Filenames, metadata values, pixel data, data URLs, object URLs, hashes, and decoder exception details are excluded from logs and console output. A failed load clears any prior export eligibility. A stale asynchronous decode or encode result cannot replace a newer selection.

Unsupported format, malformed structure, excessive size, memory pressure, incomplete metadata inspection, output metadata verification failure, re-decode failure, redaction verification failure, source hash change, or download preparation failure blocks completion. Kairo never offers the unmodified source as a fallback “sanitized” download.

No operation initiates network access. Content Security Policy remains `connect-src 'self'`; raster sanitization makes no API call. Tests must fail if `fetch`, `XMLHttpRequest`, WebSocket, beacon, or external resource loading occurs during an image session.

## 10. Test Design

### 10.1 Raster checkpoint

TDD begins with pure model, parser, renderer, and state-machine tests, followed by DOM/browser and packaged-runtime tests. Synthetic fixtures contain conspicuous canaries and no real PHI.

Required coverage:

- source SHA-256 and bytes remain unchanged after preview and export;
- JPEG EXIF, XMP, IPTC/APP13, comments, and unapproved APP metadata are absent from output;
- PNG EXIF and textual metadata are absent from output;
- output metadata verifier rejects forbidden or trailing content;
- one and multiple rectangles produce the expected opaque stored pixels;
- exported decode contains no overlay/annotation object or separable redaction model;
- rectangle coordinates remain correct across zoom and device-pixel ratios;
- undo removes only the latest region and invalidates review;
- reset and clear have the specified different effects and release resources;
- zero-redaction review remains possible but does not imply no visible PHI;
- review is invalidated by every output-affecting change;
- malformed, mislabeled, animated, and unsupported images fail closed;
- size, dimension, pixel-count, rectangle-count, and memory limits are enforced before dangerous allocation;
- stale asynchronous work cannot leak or replace a newer selection;
- source and preview data never enter history, browser storage, URL state, console, or logs;
- no network primitive is invoked;
- output names are safe and never default to the original name;
- keyboard and screen-reader paths can complete redaction and review;
- actual Chromium-based workstation browser behavior matches encoder assumptions;
- the published self-contained folder works under the accepted standard-user/no-PowerShell/no-install constraints.

Package acceptance reopens the exported file in a second decoder, re-runs the metadata scanner, inspects redacted pixel samples, confirms the original hash, and manually reviews the whole image.

### 10.2 Later DICOM checkpoint

In addition to all relevant raster assertions, DICOM tests cover each action code in the pinned PS3.15 table, nested sequences, known PHI tags, free text, private creators and private tags, consistent UID remapping and references, temporal policy, institution/device/person identifiers, Burned In Annotation values, graphics and overlays, multi-frame pixel redaction, compressed and native supported syntaxes, unsupported-syntax rejection, required-attribute validity, file-meta consistency, output reopen/decode, no raw-value logging, no unintended persistence, and unchanged original hashes.

Conformance fixtures must be synthetic, provenance-documented, and include both expected-success and fail-closed cases. A second independent parser/validator should check generated objects where practical.

## 11. Checkpoint and Release Gates

### Raster checkpoint gate

Implementation planning may begin only after this specification is approved. The user-testable checkpoint ends when PNG/JPEG behavior passes automated tests and the actual published workstation folder is ready for manual verification. DICOM controls remain visibly unavailable and must not imply partial support.

### DICOM checkpoint gate

DICOM work requires a separate approved design addendum or implementation plan that names the library/version/license, pinned PS3.15 edition and options, supported SOP classes and transfer syntaxes, UID/date policy, temporary-data model, API transport limits, conformance fixtures, and validation strategy. Raster acceptance does not authorize DICOM implementation.

### Out of scope

- OCR or automated certification;
- cloud processing or upload;
- directory/batch scanning;
- reversible annotations;
- editing originals;
- face recognition or automatic facial de-identification;
- arbitrary image formats;
- DICOM Structured Reports, encapsulated documents, waveforms, video, or unsupported SOP classes;
- claims of legal, regulatory, clinical, or disclosure-policy compliance.

## 12. Approval Decision

Approval of this specification authorizes implementation planning for the PNG/JPEG first checkpoint only. It does not authorize implementation, DICOM sanitization, dependency addition, code-signing work, or unrelated feature changes.
