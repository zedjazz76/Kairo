# HL7 Toolkit Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Deliver a portable Windows HL7 v2 tool that sanitizes, catalogs, inspects, edits, compares, validates, and sends exactly one reviewed message over MLLP while persisting only sanitized history.

**Architecture:** A dependency-free HTML, CSS, and JavaScript workspace runs in the default browser and keeps raw HL7 in memory. A loopback-only Windows PowerShell helper serves local assets, writes sanitized history atomically, and performs one outbound TCP/MLLP exchange per confirmed request.

**Tech Stack:** HTML5, CSS, vanilla ECMAScript modules and Web Workers, Windows PowerShell 5.1, built-in .NET networking and cryptography, Node.js built-in test runner for development tests, and synthetic HL7 fixtures only.

**Spec:** docs/superpowers/specs/2026-09-03-hl7-toolkit-phase-1-design.md

## Execution Status

- [x] Task 1: Portable loopback shell and secure static server (local integration probe passed).
- [x] Task 2: Lossless parser and progressive catalog (7 focused tests passed).
- [x] Task 3: Patient-PHI sanitizer and residual scan (8 focused tests passed).
- [x] Task 4: Sanitized history and clipboard boundary (4 focused tests and API probe passed).
- [x] Task 5: Editing and comparison workbench (28 current tests and service probe passed; browser visual check remains in Task 8).
- [x] Task 6: Basic validation and send preconditions (4 focused tests and editor/UI regressions passed).
- [x] Task 7: One-message MLLP, safe profiles, review confirmation, and ACK analysis (48 automated tests and service probe passed on September 4).
- [ ] Task 8: Automated integration and documentation completed September 4 (63 tests plus service probe passed; exact 100 MiB full workflow processed 43,259 messages). Browser automation cannot attach on the work laptop, so visual/manual acceptance remains unverified. HP-laptop handoff/package deferred at the user's request; do not create a bundle until requested.

## Global Constraints

- The delivered application requires no installer, compilation, package installation, service, firewall exception, registry change, or elevated privilege.
- Bind the helper only to 127.0.0.1 and require a new cryptographically random token for every launch.
- Use no CDN, telemetry, cloud service, analytics service, model API, or external runtime dependency.
- Never write raw HL7, reversible replacement dictionaries, request bodies, or raw transport responses to disk or diagnostic output.
- Accept one selected file up to exactly 104,857,600 bytes and process it progressively outside the main browser thread.
- Preserve unknown messages, custom delimiters, empty values, repetitions, escapes, and Z-segments.
- Preserve provider elements by default while sanitizing patient-related identifiers, names, dates, addresses, contact details, and high-risk free text.
- Copy and send require explicit user actions. Sending permits exactly one message and one MLLP frame per confirmation.
- Never provide inbound listening, batch transmission, replay, scheduling, or automatic retry.
- Store real endpoint profiles and all runtime history under ignored local data paths.
- Commit only source, documentation, tests, legally distributable definition data, and synthetic fixtures.
- Do not place real patient data, production endpoint values, credentials, certificates, or operational secrets in Git or test output.

---

## File Map

### Portable shell and service

- Create hl7-toolkit/Open HL7 Toolkit.cmd — one-click launcher.
- Create hl7-toolkit/service/Start-HL7Toolkit.ps1 — process startup, token, port selection, and browser launch.
- Create hl7-toolkit/service/HL7Toolkit.Security.psm1 — token generation, loopback checks, path allowlisting, and response headers.
- Create hl7-toolkit/service/HL7Toolkit.Http.psm1 — minimal TcpListener-based local HTTP server and route dispatch.
- Create hl7-toolkit/service/HL7Toolkit.History.psm1 — atomic sanitized history and deletion.
- Create hl7-toolkit/service/HL7Toolkit.Mllp.psm1 — endpoint check and one-message MLLP exchange.
- Create hl7-toolkit/service/HL7Toolkit.Profiles.psm1 — safe local endpoint-profile persistence.

### Browser application

- Create hl7-toolkit/app/index.html — combined Home and workbench shell.
- Create hl7-toolkit/app/styles/app.css — high-contrast responsive design.
- Create hl7-toolkit/app/scripts/app.mjs — application bootstrap and state transitions.
- Create hl7-toolkit/app/scripts/api.mjs — authenticated loopback API client.
- Create hl7-toolkit/app/scripts/hl7-parser.mjs — generic ER7 parser and serializer.
- Create hl7-toolkit/app/scripts/message-catalog.mjs — progressive message boundary and metadata catalog.
- Create hl7-toolkit/app/workers/intake-worker.mjs — background catalog worker.
- Create hl7-toolkit/app/scripts/sanitizer.mjs — structured replacement and in-memory session dictionary.
- Create hl7-toolkit/app/scripts/residual-scan.mjs — non-AI high-risk free-text and pattern scan.
- Create hl7-toolkit/app/scripts/clipboard.mjs — reviewed sanitized clipboard boundary.
- Create hl7-toolkit/app/scripts/editor.mjs — immutable structure-aware message edits and undo records.
- Create hl7-toolkit/app/scripts/diff.mjs — exact and semantic two-message comparison.
- Create hl7-toolkit/app/scripts/validator.mjs — Phase 1 preflight findings.
- Create hl7-toolkit/app/scripts/ack.mjs — ACK, NAK, MSA, and ERR interpretation.
- Create hl7-toolkit/app/scripts/workbench.mjs — DOM rendering and user actions.
- Create hl7-toolkit/app/definitions/phi-rules.v1.json — reviewed patient-PHI path rules.
- Create hl7-toolkit/app/definitions/basic-fields.v1.json — legally distributable Phase 1 labels only.

### Tests and documentation

- Create tests/hl7-toolkit/portable-shell.test.mjs.
- Create tests/hl7-toolkit/parser.test.mjs.
- Create tests/hl7-toolkit/catalog.test.mjs.
- Create tests/hl7-toolkit/sanitizer.test.mjs.
- Create tests/hl7-toolkit/history-privacy.test.mjs.
- Create tests/hl7-toolkit/editor-diff.test.mjs.
- Create tests/hl7-toolkit/validator.test.mjs.
- Create tests/hl7-toolkit/mllp-ack.test.mjs.
- Create tests/hl7-toolkit/ui-contract.test.mjs.
- Create tests/hl7-toolkit/helpers/mllp-stub.ps1.
- Create tests/hl7-toolkit/helpers/service-probe.ps1.
- Create tests/hl7-toolkit/fixtures/synthetic/messages.hl7.
- Create tests/hl7-toolkit/fixtures/synthetic/ack-aa.hl7.
- Create tests/hl7-toolkit/fixtures/synthetic/ack-ae.hl7.
- Create hl7-toolkit/README.md.
- Create hl7-toolkit/SECURITY.md.
- Create hl7-toolkit/HANDOFF.md.
- Modify .gitignore — exclude hl7-toolkit/data and generated handoff work while retaining safe README files.

---

### Task 1: Portable Loopback Shell and Secure Static Server

**Files:**
- Create: hl7-toolkit/Open HL7 Toolkit.cmd
- Create: hl7-toolkit/service/Start-HL7Toolkit.ps1
- Create: hl7-toolkit/service/HL7Toolkit.Security.psm1
- Create: hl7-toolkit/service/HL7Toolkit.Http.psm1
- Create: hl7-toolkit/app/index.html
- Create: hl7-toolkit/app/styles/app.css
- Test: tests/hl7-toolkit/portable-shell.test.mjs
- Test: tests/hl7-toolkit/helpers/service-probe.ps1

**Interfaces:**
- Produces: New-HL7SessionToken -> 64-character lowercase hexadecimal string.
- Produces: Start-HL7ToolkitServer -Root string -DataRoot string -Token string -Port int.
- Produces: Start-HL7Toolkit.ps1 parameters Port, Token, DataRoot, and NoBrowser for deterministic tests.
- Produces: GET /health with JSON containing status, version, and loopback.
- Produces: static GET routes under the allowlisted app root.
- Consumes: no prior Phase 1 interface.

- [ ] **Step 1: Write the failing portable-shell contract test**

~~~javascript
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('launcher and server require no elevation and bind loopback', () => {
  const launcher = readFileSync('hl7-toolkit/Open HL7 Toolkit.cmd', 'utf8');
  const start = readFileSync('hl7-toolkit/service/Start-HL7Toolkit.ps1', 'utf8');
  assert.match(launcher, /powershell(?:\.exe)?/i);
  assert.doesNotMatch(launcher + start, /runas|Start-Process.+-Verb\s+RunAs|netsh|New-Service|Set-ExecutionPolicy/i);
  assert.match(start, /127\.0\.0\.1/);
  assert.match(start, /New-HL7SessionToken/);
});
~~~

- [ ] **Step 2: Run the focused test and verify the missing files fail**

Run: node --test tests/hl7-toolkit/portable-shell.test.mjs
Expected: FAIL with ENOENT for Open HL7 Toolkit.cmd.

- [ ] **Step 3: Implement the launcher, token generator, and loopback server**

Use a TcpListener rather than HttpListener so startup never depends on URL ACL registration.

~~~powershell
function New-HL7SessionToken {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return -join ($bytes | ForEach-Object { $_.ToString('x2') })
}

function Start-HL7ToolkitServer {
  param([string]$Root, [string]$DataRoot, [string]$Token, [int]$Port)
  $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
  $listener.Start()
  try {
    while ($true) {
      $client = $listener.AcceptTcpClient()
      Invoke-HL7HttpConnection -Client $client -Root $Root -DataRoot $DataRoot -Token $Token
    }
  } finally {
    $listener.Stop()
  }
}
~~~

The HTTP connection handler must cap request headers, reject path traversal, require the token on API routes, send Cache-Control: no-store, X-Content-Type-Options: nosniff, Referrer-Policy: no-referrer, and a local-only Content Security Policy.

- [ ] **Step 4: Add the secure service probe**

~~~powershell
$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
$securityModule = Join-Path $repoRoot 'hl7-toolkit\service\HL7Toolkit.Security.psm1'
$startScript = Join-Path $repoRoot 'hl7-toolkit\service\Start-HL7Toolkit.ps1'
Import-Module $securityModule -Force
$token = New-HL7SessionToken
$portProbe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
$portProbe.Start()
$port = $portProbe.LocalEndpoint.Port
$portProbe.Stop()
$dataRoot = Join-Path ([IO.Path]::GetTempPath()) ('hl7-toolkit-probe-' + [Guid]::NewGuid().ToString('N'))
$arguments = @(
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $startScript,
  '-Port', $port, '-Token', $token, '-DataRoot', $dataRoot, '-NoBrowser'
)
$process = Start-Process powershell.exe -ArgumentList $arguments -WindowStyle Hidden -PassThru
try {
  $ready = $false
  for ($attempt = 0; $attempt -lt 40; $attempt += 1) {
    try {
      $good = Invoke-RestMethod -Uri ('http://127.0.0.1:' + $port + '/health?token=' + $token)
      $ready = $good.status -eq 'ok' -and $good.loopback
      if ($ready) { break }
    } catch {}
    Start-Sleep -Milliseconds 100
  }
  if (-not $ready) { throw 'health contract failed' }
  try {
    Invoke-WebRequest -UseBasicParsing -Uri ('http://127.0.0.1:' + $port + '/api/session') | Out-Null
    throw 'unauthorized request unexpectedly succeeded'
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -notin @(401,403)) { throw }
  }
} finally {
  if (-not $process.HasExited) { Stop-Process -Id $process.Id }
}
~~~

- [ ] **Step 5: Run shell and service tests**

Run: node --test tests/hl7-toolkit/portable-shell.test.mjs
Run: powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/hl7-toolkit/helpers/service-probe.ps1
Expected: PASS; probe confirms health and rejects the unkeyed API request.

- [ ] **Step 6: Commit the portable shell**

~~~text
git add hl7-toolkit tests/hl7-toolkit/portable-shell.test.mjs tests/hl7-toolkit/helpers/service-probe.ps1
git commit -m "feat: add portable HL7 toolkit shell"
~~~

### Task 2: Generic HL7 Parser and Progressive 100 MB Catalog

**Files:**
- Create: hl7-toolkit/app/scripts/hl7-parser.mjs
- Create: hl7-toolkit/app/scripts/message-catalog.mjs
- Create: hl7-toolkit/app/workers/intake-worker.mjs
- Create: tests/hl7-toolkit/parser.test.mjs
- Create: tests/hl7-toolkit/catalog.test.mjs
- Create: tests/hl7-toolkit/fixtures/synthetic/messages.hl7

**Interfaces:**
- Produces: parseHl7(source: string) -> ParsedMessage.
- Produces: serializeHl7(message: ParsedMessage) -> string.
- Produces: catalogHl7(source: string, options: CatalogOptions) -> Promise<CatalogResult>.
- Produces worker messages: progress and complete.
- Consumes: browser workspace created in Task 1.

- [ ] **Step 1: Write failing parser preservation tests**

~~~javascript
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHl7, serializeHl7 } from '../../hl7-toolkit/app/scripts/hl7-parser.mjs';

test('parses custom delimiters and preserves an untouched message exactly', () => {
  const source = 'MSH*$%!?*SEND*FAC*RECV*FAC*202609031200**ADT$A01*CTRL-1*P*2.5.1\rZXY*1**A$B';
  const parsed = parseHl7(source);
  assert.deepEqual(parsed.delimiters, {
    field: '*', component: '$', repetition: '%', escape: '!', subcomponent: '?'
  });
  assert.equal(parsed.segments[1].name, 'ZXY');
  assert.equal(serializeHl7(parsed), source);
});
~~~

- [ ] **Step 2: Run the parser test and verify import failure**

Run: node --test tests/hl7-toolkit/parser.test.mjs
Expected: FAIL because hl7-parser.mjs does not exist.

- [ ] **Step 3: Implement lossless parsing and stable paths**

~~~javascript
export function parseHl7(source) {
  if (typeof source !== 'string') throw new TypeError('HL7 source must be text');
  const segmentDelimiter = detectSegmentDelimiter(source);
  const rawSegments = splitPreservingDelimiters(source, segmentDelimiter);
  const msh = rawSegments.find((item) => item.text.startsWith('MSH'));
  if (!msh || msh.text.length < 8) return genericMalformedMessage(source, rawSegments);
  const field = msh.text[3];
  const encoding = msh.text.slice(4, 8);
  const delimiters = {
    field,
    component: encoding[0],
    repetition: encoding[1],
    escape: encoding[2],
    subcomponent: encoding[3]
  };
  return buildParsedMessage(source, rawSegments, segmentDelimiter, delimiters);
}

export function serializeHl7(message) {
  if (!message.edited) return message.source;
  return message.segments.map(serializeSegment).join(message.segmentDelimiter);
}
~~~

- [ ] **Step 4: Write failing catalog tests for MLLP, batches, prefixes, and cancellation**

~~~javascript
import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogHl7 } from '../../hl7-toolkit/app/scripts/message-catalog.mjs';

test('catalogs MLLP framed messages and exposes MSH metadata', async () => {
  const text = '\u000bMSH|^~\\&|A|F|B|F|202609031200||ORM^O01|ONE|P|2.5.1\rPID|1||MRN1\u001c\r' +
    '\u000bMSH|^~\\&|A|F|B|F|202609031201||ORU^R01|TWO|P|2.5.1\rPID|1||MRN2\u001c\r';
  const result = await catalogHl7(text);
  assert.equal(result.messages.length, 2);
  assert.equal(result.messages[1].controlId, 'TWO');
  assert.equal(result.messages[1].type, 'ORU^R01');
});
~~~

- [ ] **Step 5: Implement progressive catalog and worker protocol**

The catalog scans in bounded character chunks, yields between chunks, emits progress no less often than each processed megabyte, and checks AbortSignal before continuing.

~~~javascript
export async function catalogHl7(source, { onProgress = () => {}, signal } = {}) {
  const messages = [];
  for (const boundary of scanMessageBoundaries(source)) {
    if (signal?.aborted) throw new DOMException('Catalog canceled', 'AbortError');
    messages.push(readCatalogMetadata(source, boundary));
    if (boundary.end % 1048576 < boundary.start % 1048576) {
      onProgress({ processed: boundary.end, total: source.length, messages: messages.length });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  return { messages, warnings: collectBoundaryWarnings(source, messages) };
}
~~~

- [ ] **Step 6: Run parser and catalog tests**

Run: node --test tests/hl7-toolkit/parser.test.mjs tests/hl7-toolkit/catalog.test.mjs
Expected: PASS for custom delimiters, empty values, Z-segments, line endings, MLLP, batches, warnings, metadata, and cancellation.

- [ ] **Step 7: Commit parsing and intake**

~~~text
git add hl7-toolkit/app/scripts/hl7-parser.mjs hl7-toolkit/app/scripts/message-catalog.mjs hl7-toolkit/app/workers tests/hl7-toolkit
git commit -m "feat: parse and catalog HL7 logs"
~~~

### Task 3: Patient-PHI Sanitizer and Residual Scan

**Files:**
- Create: hl7-toolkit/app/scripts/sanitizer.mjs
- Create: hl7-toolkit/app/scripts/residual-scan.mjs
- Create: hl7-toolkit/app/definitions/phi-rules.v1.json
- Create: tests/hl7-toolkit/sanitizer.test.mjs

**Interfaces:**
- Consumes: ParsedMessage from Task 2.
- Produces: createSanitizerSession(rules) -> SanitizerSession.
- Produces: session.sanitize(message, mode) -> SanitizedResult.
- Produces: scanResidual(text, context) -> ResidualWarning[].
- SanitizedResult contains text, replacements, warnings, coverage, and policyVersion; it never contains the reversible map.

- [ ] **Step 1: Write failing sanitizer tests with unique synthetic canaries**

~~~javascript
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseHl7 } from '../../hl7-toolkit/app/scripts/hl7-parser.mjs';
import { createSanitizerSession } from '../../hl7-toolkit/app/scripts/sanitizer.mjs';

const rules = JSON.parse(readFileSync(
  'hl7-toolkit/app/definitions/phi-rules.v1.json',
  'utf8'
));

test('replaces patients consistently and preserves provider fields', () => {
  const first = parseHl7('MSH|^~\\&|A|F|B|F|202609031200||ORU^R01|ONE|P|2.5.1\r' +
    'PID|1||CANARY-MRN-771||CANARYFAMILY^CANARYGIVEN||19800506\r' +
    'OBR|1|ORD1|||TEST||||||||||||1234^VISIBLEPROVIDER^ALICE');
  const second = parseHl7('MSH|^~\\&|A|F|B|F|202609031201||ORU^R01|TWO|P|2.5.1\r' +
    'PID|1||CANARY-MRN-771||CANARYFAMILY^CANARYGIVEN||19800506\r' +
    'OBX|1|TX|NOTE||Patient CANARYGIVEN CANARYFAMILY called from 555-555-0199');
  const session = createSanitizerSession(rules);
  const one = session.sanitize(first, 'chat-safe');
  const two = session.sanitize(second, 'chat-safe');
  assert.match(one.text, /VISIBLEPROVIDER\^ALICE/);
  assert.doesNotMatch(one.text + two.text, /CANARY|19800506|555-555-0199/);
  assert.match(one.text + two.text, /MRN-0001/);
});
~~~

- [ ] **Step 2: Run sanitizer tests and verify missing module failure**

Run: node --test tests/hl7-toolkit/sanitizer.test.mjs
Expected: FAIL because sanitizer.mjs does not exist.

- [ ] **Step 3: Implement typed rules, stable replacements, and date modes**

~~~javascript
export function createSanitizerSession(rules) {
  const maps = new Map();
  const sequence = new Map();
  function token(category, value) {
    const key = category + '\u0000' + value;
    if (maps.has(key)) return maps.get(key);
    const next = (sequence.get(category) || 0) + 1;
    sequence.set(category, next);
    const replacement = formatReplacement(category, next);
    maps.set(key, replacement);
    return replacement;
  }
  return {
    sanitize(message, mode) {
      return sanitizeParsedMessage(message, { rules, mode, token });
    },
    destroy() {
      maps.clear();
      sequence.clear();
    }
  };
}
~~~

The rule file must identify patient paths, provider-preserved paths, date behavior, and category names. It must contain no production values.

- [ ] **Step 4: Implement deterministic residual warnings**

~~~javascript
export function scanResidual(text, { knownRawValues = [] } = {}) {
  const warnings = [];
  for (const value of knownRawValues.filter((item) => item.length >= 3)) {
    if (text.includes(value)) warnings.push(warning('KNOWN_VALUE', value.length));
  }
  applyPattern(warnings, text, 'EMAIL', EMAIL_PATTERN);
  applyPattern(warnings, text, 'PHONE', PHONE_PATTERN);
  applyPattern(warnings, text, 'SSN', SSN_PATTERN);
  applyPattern(warnings, text, 'IP_ADDRESS', IP_PATTERN);
  return deduplicateWarnings(warnings);
}
~~~

Warnings store type, location, confidence, and length. They do not expose the matched raw text in persistent representations.

- [ ] **Step 5: Run sanitizer tests**

Run: node --test tests/hl7-toolkit/sanitizer.test.mjs
Expected: PASS for structured values, free text, provider preservation, stable replacements, both date modes, coverage, and nonreversible output.

- [ ] **Step 6: Commit sanitizer**

~~~text
git add hl7-toolkit/app/scripts/sanitizer.mjs hl7-toolkit/app/scripts/residual-scan.mjs hl7-toolkit/app/definitions/phi-rules.v1.json tests/hl7-toolkit/sanitizer.test.mjs
git commit -m "feat: sanitize patient PHI in HL7 messages"
~~~

### Task 4: Sanitized History and Clipboard Boundary

**Files:**
- Create: hl7-toolkit/service/HL7Toolkit.History.psm1
- Create: hl7-toolkit/app/scripts/api.mjs
- Create: hl7-toolkit/app/scripts/clipboard.mjs
- Create: tests/hl7-toolkit/history-privacy.test.mjs
- Modify: hl7-toolkit/service/HL7Toolkit.Http.psm1
- Modify: .gitignore

**Interfaces:**
- Consumes: SanitizedResult from Task 3.
- Produces: saveSanitizedEvent(event) -> Promise<void>.
- Produces: copySanitized(result, options) -> Promise<ClipboardReceipt>.
- Produces PowerShell: Write-HL7SanitizedEvent, Get-HL7History, Remove-HL7History.
- HTTP routes: POST /api/history/events, GET /api/history, DELETE /api/history/session.

- [ ] **Step 1: Write a failing filesystem canary test**

~~~javascript
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

function allText(root) {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => readFileSync(path.join(entry.parentPath, entry.name), 'utf8'))
    .join('\n');
}

test('history rejects raw fields and never persists their canaries', () => {
  const dataRoot = mkdtempSync(path.join(tmpdir(), 'hl7-history-'));
  const inputRoot = mkdtempSync(path.join(tmpdir(), 'hl7-history-input-'));
  const eventPath = path.join(inputRoot, 'event.json');
  const rawCanary = 'RAW-PHI-CANARY-991827';
  writeFileSync(eventPath, JSON.stringify({
    schema: 'hl7-toolkit.sanitized-event.v1',
    type: 'clipboard-copy',
    sanitizedText: 'MRN-0001',
    rawText: rawCanary
  }));
  const command = [
    "Import-Module './hl7-toolkit/service/HL7Toolkit.History.psm1' -Force",
    '$event = Get-Content -Raw ' + "'" + eventPath.replaceAll("'", "''") + "'" + ' | ConvertFrom-Json',
    "Write-HL7SanitizedEvent -DataRoot '" + dataRoot.replaceAll("'", "''") + "' -SessionId test -Event $event"
  ].join('; ');
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command]);
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(allText(dataRoot), new RegExp(rawCanary));
});
~~~

- [ ] **Step 2: Run the history test and verify missing implementation failure**

Run: node --test tests/hl7-toolkit/history-privacy.test.mjs
Expected: FAIL because the history API and module do not exist.

- [ ] **Step 3: Implement atomic sanitized event writes**

~~~powershell
function Assert-HL7SanitizedSchema {
  param([object]$Event)
  $forbidden = @('rawText', 'originalText', 'requestBody', 'responseBody', 'reversibleMap')
  foreach ($name in $forbidden) {
    if ($Event.PSObject.Properties.Name -contains $name) { throw 'HISTORY_RAW_FIELD_REJECTED' }
  }
  if ($Event.type -notin @('clipboard-copy', 'message-save', 'send-result', 'comparison-save')) {
    throw 'HISTORY_EVENT_TYPE_REJECTED'
  }
}

function Write-HL7SanitizedEvent {
  param([string]$DataRoot, [string]$SessionId, [object]$Event)
  if ($Event.schema -ne 'hl7-toolkit.sanitized-event.v1') { throw 'HISTORY_SCHEMA_REJECTED' }
  Assert-HL7SanitizedSchema -Event $Event
  $session = Join-Path (Join-Path $DataRoot 'history') $SessionId
  [IO.Directory]::CreateDirectory($session) | Out-Null
  $json = $Event | ConvertTo-Json -Depth 12 -Compress
  $events = Join-Path $session 'events.jsonl'
  [IO.File]::AppendAllText($events, $json + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
}
~~~

Manifest replacement uses a sanitized temporary file in the same directory, flushes it, and atomically replaces the prior manifest. Service errors contain only safe codes.

- [ ] **Step 4: Implement the reviewed clipboard boundary**

~~~javascript
export async function copySanitized(result, {
  acknowledgedWarningIds = [],
  saveEvent,
  clipboard = navigator.clipboard
}) {
  const unresolved = result.warnings.filter((item) => !acknowledgedWarningIds.includes(item.id));
  if (unresolved.length) throw new Error('UNRESOLVED_SANITIZER_WARNINGS');
  await saveEvent({
    schema: 'hl7-toolkit.sanitized-event.v1',
    type: 'clipboard-copy',
    sanitizedText: result.text,
    warningCounts: countWarningTypes(result.warnings),
    policyVersion: result.policyVersion
  });
  await clipboard.writeText(result.text);
  return { copiedCharacters: result.text.length };
}
~~~

- [ ] **Step 5: Add history deletion and ignored runtime paths**

Remove-HL7History accepts resolved session IDs only, verifies every target remains beneath data/history, returns the exact deleted count, and never uses unresolved wildcards.

Add these ignore rules:

~~~gitignore
hl7-toolkit/data/*
!hl7-toolkit/data/README.md
deliverables/HL7-Toolkit-*-Handoff-*/
~~~

- [ ] **Step 6: Run privacy and shell regression tests**

Run: node --test tests/hl7-toolkit/history-privacy.test.mjs tests/hl7-toolkit/portable-shell.test.mjs tests/hl7-toolkit/sanitizer.test.mjs
Expected: PASS, including recursive canary scan and failed-write blocking.

- [ ] **Step 7: Commit the history boundary**

~~~text
git add .gitignore hl7-toolkit/service hl7-toolkit/app/scripts/api.mjs hl7-toolkit/app/scripts/clipboard.mjs tests/hl7-toolkit/history-privacy.test.mjs
git commit -m "feat: persist sanitized HL7 history"
~~~

### Task 5: Workbench Editing and Two-Message Comparison

**Files:**
- Create: hl7-toolkit/app/scripts/editor.mjs
- Create: hl7-toolkit/app/scripts/diff.mjs
- Create: hl7-toolkit/app/scripts/workbench.mjs
- Create: tests/hl7-toolkit/editor-diff.test.mjs
- Modify: hl7-toolkit/app/index.html
- Modify: hl7-toolkit/app/styles/app.css
- Modify: hl7-toolkit/app/scripts/app.mjs

**Interfaces:**
- Consumes: ParsedMessage and serializeHl7 from Task 2.
- Produces: applyEdit(message, operation) -> EditReceipt.
- Produces: undoEdit(receipt) -> ParsedMessage.
- Produces: exactDiff(left, right) -> ExactChange[].
- Produces: semanticDiff(leftParsed, rightParsed, options) -> SemanticChange[].
- Produces: mountWorkbench(root, state) -> WorkbenchController.

- [ ] **Step 1: Write failing immutable edit and diff tests**

~~~javascript
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHl7, getValue, serializeHl7 } from '../../hl7-toolkit/app/scripts/hl7-parser.mjs';
import { applyEdit, undoEdit } from '../../hl7-toolkit/app/scripts/editor.mjs';
import { semanticDiff } from '../../hl7-toolkit/app/scripts/diff.mjs';

test('edits one path without changing untouched elements', () => {
  const message = parseHl7('MSH|^~\\&|A|F|B|F|202609031200||ORM^O01|ONE|P|2.5.1\rPID|1||MRN-0001');
  const receipt = applyEdit(message, { type: 'set-value', path: 'PID-3.1', value: 'MRN-0002' });
  assert.equal(getValue(message, 'PID-3.1'), 'MRN-0001');
  assert.equal(getValue(receipt.message, 'PID-3.1'), 'MRN-0002');
  assert.equal(serializeHl7(undoEdit(receipt)), serializeHl7(message));
});

test('semantic diff ignores only explicitly named paths', () => {
  const left = parseHl7('MSH|^~\\&|A|F|B|F|202609031200||ORM^O01|LEFT|P|2.5.1\rPID|1||MRN-0001');
  const right = parseHl7('MSH|^~\\&|A|F|B|F|202609031205||ORM^O01|RIGHT|P|2.5.1\rPID|1||MRN-0002');
  const changes = semanticDiff(left, right, { ignoredPaths: ['MSH-7', 'MSH-10'] });
  assert.deepEqual(changes.map((item) => item.path), ['PID-3.1']);
});
~~~

- [ ] **Step 2: Run the focused test and verify import failure**

Run: node --test tests/hl7-toolkit/editor-diff.test.mjs
Expected: FAIL because editor.mjs and diff.mjs do not exist.

- [ ] **Step 3: Implement immutable edits and undo receipts**

~~~javascript
export function applyEdit(message, operation) {
  const before = serializeHl7(message);
  const next = cloneParsedMessage(message);
  applyOperation(next, operation);
  next.edited = true;
  return {
    message: next,
    before,
    after: serializeHl7(next),
    inverse: invertOperation(message, operation)
  };
}
~~~

- [ ] **Step 4: Implement exact and semantic diff**

~~~javascript
export function semanticDiff(left, right, { ignoredPaths = [] } = {}) {
  const ignored = new Set(ignoredPaths);
  const leftValues = flattenPaths(left);
  const rightValues = flattenPaths(right);
  const paths = new Set([...leftValues.keys(), ...rightValues.keys()]);
  return [...paths]
    .filter((path) => !ignored.has(path))
    .filter((path) => leftValues.get(path) !== rightValues.get(path))
    .map((path) => ({
      path,
      before: leftValues.get(path),
      after: rightValues.get(path),
      kind: classifyDifference(leftValues, rightValues, path)
    }));
}
~~~

- [ ] **Step 5: Build the combined Home and workbench shell**

The DOM must include Home drop zone, Quick Sanitize action, workspace navigation, message list, raw/tree tabs, field details, collapsible findings, Compare selection A/B, undo/redo, and explicit high-contrast labels.

- [ ] **Step 6: Run edit, parser, sanitizer, and UI contract tests**

Run: node --test tests/hl7-toolkit/editor-diff.test.mjs tests/hl7-toolkit/parser.test.mjs tests/hl7-toolkit/sanitizer.test.mjs tests/hl7-toolkit/ui-contract.test.mjs
Expected: PASS; UI contract confirms all approved workspaces and visible text labels.

- [ ] **Step 7: Commit workbench and comparison**

~~~text
git add hl7-toolkit/app tests/hl7-toolkit/editor-diff.test.mjs tests/hl7-toolkit/ui-contract.test.mjs
git commit -m "feat: add HL7 editing and comparison workbench"
~~~

### Task 6: Basic Validation and Send Preconditions

**Files:**
- Create: hl7-toolkit/app/scripts/validator.mjs
- Create: hl7-toolkit/app/definitions/basic-fields.v1.json
- Create: tests/hl7-toolkit/validator.test.mjs
- Modify: hl7-toolkit/app/scripts/workbench.mjs

**Interfaces:**
- Consumes: ParsedMessage and CatalogResult from Task 2.
- Produces: validateBasic(message, context) -> Finding[].
- Finding contains id, severity, source, path, code, summary, and overridable.
- Produces: summarizeSendPreflight(findings) -> PreflightSummary.

- [ ] **Step 1: Write failing validation coverage tests**

~~~javascript
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHl7 } from '../../hl7-toolkit/app/scripts/hl7-parser.mjs';
import { validateBasic } from '../../hl7-toolkit/app/scripts/validator.mjs';

test('distinguishes errors, warnings, and not-evaluated coverage', () => {
  const message = parseHl7('MSH|^~\\&|A|F|B|F|BADDATE||ORM^O01||P|\rZXY|1');
  const findings = validateBasic(message, { controlIds: new Map() });
  assert.ok(findings.some((item) => item.code === 'MSH_10_REQUIRED' && item.severity === 'error'));
  assert.ok(findings.some((item) => item.code === 'TIMESTAMP_SYNTAX'));
  assert.ok(findings.some((item) => item.code === 'UNKNOWN_SEGMENT' && item.severity === 'not-evaluated'));
});
~~~

- [ ] **Step 2: Run the validator test and verify import failure**

Run: node --test tests/hl7-toolkit/validator.test.mjs
Expected: FAIL because validator.mjs does not exist.

- [ ] **Step 3: Implement explicit Phase 1 checks**

~~~javascript
export function validateBasic(message, { controlIds = new Map() } = {}) {
  const findings = [];
  requireValue(findings, message, 'MSH-9', 'MSH_9_REQUIRED');
  requireValue(findings, message, 'MSH-10', 'MSH_10_REQUIRED');
  requireValue(findings, message, 'MSH-12', 'MSH_12_REQUIRED');
  validateEncodingCharacters(findings, message);
  validateRecognizedTimestamps(findings, message);
  validateRecognizedNumbers(findings, message);
  reportUnknownSegments(findings, message);
  reportDuplicateControlId(findings, message, controlIds);
  return findings;
}
~~~

Definitions must include only labels and basic datatype hints with a recorded source and license note. Missing definitions yield Not Evaluated findings.

- [ ] **Step 4: Add preflight acknowledgement state**

The workbench blocks Send until every error and warning is either resolved or explicitly acknowledged for the current serialized message hash. Any subsequent edit invalidates acknowledgements.

~~~javascript
export function summarizeSendPreflight(findings, acknowledgedIds = []) {
  const acknowledged = new Set(acknowledgedIds);
  const blocking = findings.filter((item) =>
    ['error', 'warning'].includes(item.severity) && !acknowledged.has(item.id)
  );
  return {
    ready: blocking.length === 0,
    blockingIds: blocking.map((item) => item.id),
    counts: countFindingsBySeverity(findings)
  };
}
~~~

- [ ] **Step 5: Run validation and workbench tests**

Run: node --test tests/hl7-toolkit/validator.test.mjs tests/hl7-toolkit/editor-diff.test.mjs tests/hl7-toolkit/ui-contract.test.mjs
Expected: PASS for required headers, basic datatypes, duplicates, unknown coverage, and acknowledgement invalidation.

- [ ] **Step 6: Commit basic validation**

~~~text
git add hl7-toolkit/app/scripts/validator.mjs hl7-toolkit/app/definitions/basic-fields.v1.json hl7-toolkit/app/scripts/workbench.mjs tests/hl7-toolkit/validator.test.mjs
git commit -m "feat: add HL7 send preflight validation"
~~~

### Task 7: One-Message MLLP Send and ACK Analysis

**Files:**
- Create: hl7-toolkit/service/HL7Toolkit.Mllp.psm1
- Create: hl7-toolkit/service/HL7Toolkit.Profiles.psm1
- Create: hl7-toolkit/app/scripts/ack.mjs
- Create: tests/hl7-toolkit/mllp-ack.test.mjs
- Create: tests/hl7-toolkit/helpers/mllp-stub.ps1
- Modify: hl7-toolkit/service/HL7Toolkit.Http.psm1
- Modify: hl7-toolkit/app/scripts/api.mjs
- Modify: hl7-toolkit/app/scripts/workbench.mjs

**Interfaces:**
- Produces PowerShell: Test-HL7Endpoint(profile) -> EndpointResult.
- Produces PowerShell: Send-HL7MllpMessage(profile, message) -> TransportResult.
- Produces PowerShell: Read-HL7MllpFrame and Write-HL7MllpFrame for the local synthetic stub.
- Produces PowerShell: Get-HL7EndpointProfiles, Save-HL7EndpointProfile, and Remove-HL7EndpointProfile.
- HTTP routes: POST /api/mllp/check and POST /api/mllp/send-one.
- HTTP routes: GET, POST, and DELETE /api/profiles/endpoint.
- Produces: analyzeAck(responseText, outboundControlId) -> AckAnalysis.
- Consumes: validated one-message workbench state and sanitized-history API.

- [ ] **Step 1: Write the failing ACK analyzer tests**

~~~javascript
import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeAck } from '../../hl7-toolkit/app/scripts/ack.mjs';

test('classifies and correlates an application error ACK', () => {
  const ack = 'MSH|^~\\&|ENGINE|TEST|TOOL|TEST|202609031205||ACK^O01|ACK-1|P|2.5.1\r' +
    'MSA|AE|CTRL-77|Order rejected\rERR|||ORC^1^2^1|101^Required field missing^HL70357|E';
  const result = analyzeAck(ack, 'CTRL-77');
  assert.equal(result.code, 'AE');
  assert.equal(result.category, 'application-error');
  assert.equal(result.correlated, true);
  assert.equal(result.errors[0].location, 'ORC^1^2^1');
});
~~~

- [ ] **Step 2: Run the ACK test and verify import failure**

Run: node --test tests/hl7-toolkit/mllp-ack.test.mjs
Expected: FAIL because ack.mjs does not exist.

- [ ] **Step 3: Implement ACK interpretation**

~~~javascript
export function analyzeAck(responseText, outboundControlId) {
  const message = parseHl7(responseText);
  const code = getValue(message, 'MSA-1');
  const acknowledgedId = getValue(message, 'MSA-2');
  return {
    code,
    category: ACK_CATEGORIES[code] || 'unknown-ack',
    acknowledgedId,
    correlated: Boolean(outboundControlId) && acknowledgedId === outboundControlId,
    errors: readErrSegments(message)
  };
}
~~~

- [ ] **Step 4: Write the local MLLP stub and failing transport test**

~~~powershell
param([int]$Port, [string]$AckText)
Import-Module (Join-Path $PSScriptRoot '..\..\..\hl7-toolkit\service\HL7Toolkit.Mllp.psm1') -Force
$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $Port)
$listener.Start()
try {
  $client = $listener.AcceptTcpClient()
  $stream = $client.GetStream()
  $received = Read-HL7MllpFrame -Stream $stream -TimeoutMs 5000
  if ([string]::IsNullOrWhiteSpace($received)) { throw 'missing request frame' }
  Write-HL7MllpFrame -Stream $stream -Text $AckText -Encoding ([Text.Encoding]::UTF8)
  $client.Close()
} finally {
  $listener.Stop()
}
~~~

The transport test starts the stub, calls Send-HL7MllpMessage once, and asserts one request frame, one response frame, framing bytes 0x0B and 0x1C 0x0D, timing metadata, and no retry.

- [ ] **Step 5: Implement endpoint check and single exchange**

~~~powershell
function Send-HL7MllpMessage {
  param([hashtable]$Profile, [string]$Message)
  $client = [Net.Sockets.TcpClient]::new()
  $bytesSent = 0
  try {
    Connect-HL7TcpClient -Client $client -Profile $Profile
    $stream = $client.GetStream()
    $payload = ConvertTo-HL7MllpFrame -Message $Message -EncodingName $Profile.encoding
    $stream.Write($payload, 0, $payload.Length)
    $bytesSent = $payload.Length
    $response = Read-HL7MllpFrame -Stream $stream -TimeoutMs $Profile.responseTimeoutMs
    return New-HL7TransportResult -Status 'response' -BytesSent $bytesSent -Response $response
  } catch {
    return New-HL7TransportResult -Status (Get-HL7SafeTransportCode $_ $bytesSent) -BytesSent $bytesSent
  } finally {
    $client.Dispose()
  }
}
~~~

The result returned to the browser may contain the in-memory response for immediate analysis but the service must not log it. Unknown delivery is reported when bytesSent is greater than zero and no conclusive ACK arrived.

- [ ] **Step 6: Add safe endpoint-profile persistence**

Endpoint profiles use schema hl7-toolkit.endpoint-profile.v1 and contain only id, label, environment, host, port, connectTimeoutMs, responseTimeoutMs, encoding, startByte, endBytes, and nonclinical notes. Save rejects unknown properties, credentials, message content, URLs, and certificates. IDs become filenames only after strict character validation, and every resolved path must remain under data/profiles.

~~~powershell
function Save-HL7EndpointProfile {
  param([string]$DataRoot, [object]$Profile)
  $allowed = @('schema','id','label','environment','host','port','connectTimeoutMs','responseTimeoutMs','encoding','startByte','endBytes','notes')
  $unknown = @($Profile.PSObject.Properties.Name | Where-Object { $_ -notin $allowed })
  if ($unknown.Count -gt 0) { throw 'PROFILE_PROPERTY_REJECTED' }
  if ($Profile.schema -ne 'hl7-toolkit.endpoint-profile.v1') { throw 'PROFILE_SCHEMA_REJECTED' }
  if ($Profile.id -notmatch '^[a-z0-9][a-z0-9-]{0,63}$') { throw 'PROFILE_ID_REJECTED' }
  if ($Profile.environment -notin @('Test','Production')) { throw 'PROFILE_ENVIRONMENT_REJECTED' }
  if ($Profile.port -lt 1 -or $Profile.port -gt 65535) { throw 'PROFILE_PORT_REJECTED' }
  $folder = [IO.Path]::GetFullPath((Join-Path $DataRoot 'profiles'))
  [IO.Directory]::CreateDirectory($folder) | Out-Null
  $target = [IO.Path]::GetFullPath((Join-Path $folder ($Profile.id + '.json')))
  if (-not $target.StartsWith($folder, [StringComparison]::OrdinalIgnoreCase)) { throw 'PROFILE_PATH_REJECTED' }
  Write-HL7AtomicJson -Path $target -Value $Profile
}
~~~

- [ ] **Step 7: Add production and original-PHI confirmation**

The Send button requires one selected serialized message. Production plus original content uses a second confirmation naming the profile and destination. The request includes one message only; the server rejects arrays and embedded multiple MSH boundaries.

- [ ] **Step 8: Run MLLP, ACK, history, profile, and shell tests**

Run: node --test tests/hl7-toolkit/mllp-ack.test.mjs tests/hl7-toolkit/history-privacy.test.mjs tests/hl7-toolkit/portable-shell.test.mjs
Run: powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/hl7-toolkit/helpers/service-probe.ps1
Expected: PASS for all ACK codes, correlation, ERR details, custom encodings, refusal, timeout, malformed response, unknown delivery, one frame, and no retry.

- [ ] **Step 9: Commit one-message MLLP**

~~~text
git add hl7-toolkit/service hl7-toolkit/app/scripts tests/hl7-toolkit
git commit -m "feat: send one HL7 message over MLLP"
~~~

### Task 8: Integrated Privacy, Performance, Accessibility, Documentation, and Handoff

**Files:**
- Create: tests/hl7-toolkit/ui-contract.test.mjs
- Create: hl7-toolkit/data/README.md
- Create: hl7-toolkit/README.md
- Create: hl7-toolkit/SECURITY.md
- Create: hl7-toolkit/HANDOFF.md
- Modify: hl7-toolkit/app/index.html
- Modify: hl7-toolkit/app/styles/app.css
- Modify: hl7-toolkit/app/scripts/app.mjs
- Modify: .gitignore

**Interfaces:**
- Consumes: every Task 1 through Task 7 interface.
- Produces: verified Phase 1 portable folder and documented handoff workflow.
- Produces: complete automated test command and manual standard-user checklist.

- [ ] **Step 1: Write failing integrated UI and security contract tests**

~~~javascript
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('the interface exposes approved high-contrast single-send controls', () => {
  const html = readFileSync('hl7-toolkit/app/index.html', 'utf8');
  const css = readFileSync('hl7-toolkit/app/styles/app.css', 'utf8');
  for (const text of ['Quick Sanitize', 'Inspect', 'Compare', 'Validate', 'Send', 'History']) {
    assert.match(html, new RegExp(text));
  }
  assert.match(html, /Production/);
  assert.match(html, /Copy sanitized/);
  assert.doesNotMatch(html, /Batch Send|Start Listener|Auto Retry/i);
  assert.match(css, /--text:\s*#111827/i);
  assert.match(css, /:focus-visible/);
});
~~~

- [ ] **Step 2: Run the UI contract and verify missing final controls fail**

Run: node --test tests/hl7-toolkit/ui-contract.test.mjs
Expected: FAIL until the integrated labels, focus styles, and approved exclusions are present.

- [ ] **Step 3: Complete the accessible workbench integration**

Use semantic buttons, labels, dialog roles, live regions for progress and send status, visible focus, keyboard-operable panels, and explicit icon-plus-text statuses. Use #111827 or darker text on light surfaces and verify contrast for warning, error, success, Production, PHI, and Not Evaluated states.

- [ ] **Step 4: Add a generated 100 MB performance test**

The test constructs repeated synthetic messages in memory until exactly 100 MB, catalogs them, confirms progress events occur, opens an early result before completion, aborts a second run, and asserts cancellation completes within two seconds on the development machine.

~~~javascript
function makeSyntheticLog(size) {
  const message = 'MSH|^~\\&|TEST|FAC|TOOL|FAC|202609031200||ORU^R01|CTRL-0001|P|2.5.1\r' +
    'PID|1||MRN-0001||PATIENT^ALPHA\rOBR|1|ORDER-0001\rOBX|1|TX|NOTE||SYNTHETIC\r';
  return message.repeat(Math.ceil(size / message.length)).slice(0, size);
}

test('catalogs 100 MB progressively and cancels promptly', { timeout: 120000 }, async () => {
  const source = makeSyntheticLog(104857600);
  let progressCount = 0;
  const result = await catalogHl7(source, { onProgress: () => { progressCount += 1; } });
  assert.ok(result.messages.length > 1000);
  assert.ok(progressCount >= 50);
});
~~~

The same file adds a second test with AbortController, starts cataloging the 100 MB string, aborts after the first progress callback, and asserts an AbortError is returned within two seconds.

- [ ] **Step 5: Run the full automated suite**

Run: node --test tests/hl7-toolkit/*.test.mjs
Expected: every test passes with zero failures and no raw canary in temporary runtime data.

- [ ] **Step 6: Run the PowerShell service and local MLLP integration suite**

Run: powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/hl7-toolkit/helpers/service-probe.ps1
Expected: health, authorization, static file, history, deletion, connection check, single-send, and safe-error probes all pass.

- [ ] **Step 7: Perform the manual portable-user checklist**

On a standard Windows user account:

1. Copy hl7-toolkit to a path containing spaces.
2. Double-click Open HL7 Toolkit.cmd.
3. Confirm there is no UAC prompt, firewall prompt, installation, registry change, or URL ACL request.
4. Load only the 100 MB synthetic fixture.
5. Sanitize and copy a synthetic message with and without an override warning.
6. Compare and edit two synthetic messages.
7. Start the local synthetic MLLP stub and send one message.
8. Confirm the ACK is correlated and only sanitized history exists.
9. Close the browser and helper and confirm raw state is unavailable.
10. Relaunch and delete one session, then bulk-delete the remaining sessions.

- [ ] **Step 8: Write user, security, and handoff documentation**

README explains launch, Quick Sanitize, compare, one-message sending, history, and limitations in nontechnical language. SECURITY documents the volatile raw-data boundary, Safe Harbor-oriented limitation, production confirmation, and incident-safe behavior. HANDOFF documents private Git and verified bundle routes.

- [ ] **Step 9: Verify the intended Git diff contains no runtime data**

Run: git status --short
Run: git diff --check
Run: git ls-files hl7-toolkit/data
Expected: only hl7-toolkit/data/README.md is tracked under the runtime data path; no history, profile, message, certificate, or secret file appears.

- [ ] **Step 10: Commit the integrated Phase 1 release**

~~~text
git add .gitignore hl7-toolkit tests/hl7-toolkit docs/superpowers/plans/2026-09-03-hl7-toolkit-phase-1.md
git commit -m "feat: complete portable HL7 toolkit phase one"
~~~

- [ ] **Step 11: Create and verify the restricted-network handoff bundle**

Create a package named deliverables/HL7-Toolkit-Phase-1-Handoff-2026-09-03 containing:

- hl7-toolkit-phase-1.bundle;
- README.md with branch, commit, required base commit, import commands, and next step; and
- SHA256.txt.

Run: git bundle verify deliverables/HL7-Toolkit-Phase-1-Handoff-2026-09-03/hl7-toolkit-phase-1.bundle
Run: Get-FileHash -Algorithm SHA256 deliverables/HL7-Toolkit-Phase-1-Handoff-2026-09-03/hl7-toolkit-phase-1.bundle
Expected: bundle verifies, hash matches README and SHA256.txt, and the bundled branch points to the Phase 1 release commit.

- [ ] **Step 12: Record final continuation status**

The final handoff report names:

- current branch;
- Phase 1 commit;
- bundle path and SHA-256;
- test counts and commands;
- manual checks completed or still requiring a separate standard-user workstation;
- no-push status on the work laptop; and
- exact HP-laptop import instructions.

## Internal Helper Contracts

The following private helpers are implemented in the same task and file as their caller. Their names and responsibilities are fixed here so later tasks do not invent competing versions.

- HL7Toolkit.Http.psm1: Invoke-HL7HttpConnection reads one bounded HTTP request, authorizes it, dispatches a route, writes one response, and disposes the client.
- hl7-parser.mjs: detectSegmentDelimiter, splitPreservingDelimiters, genericMalformedMessage, buildParsedMessage, serializeSegment, cloneParsedMessage, getValue, and flattenPaths.
- message-catalog.mjs: scanMessageBoundaries, readCatalogMetadata, and collectBoundaryWarnings.
- sanitizer.mjs: formatReplacement and sanitizeParsedMessage.
- residual-scan.mjs: warning, applyPattern, deduplicateWarnings, EMAIL_PATTERN, PHONE_PATTERN, SSN_PATTERN, and IP_PATTERN.
- clipboard.mjs: countWarningTypes.
- editor.mjs: applyOperation and invertOperation.
- diff.mjs: classifyDifference.
- validator.mjs: requireValue, validateEncodingCharacters, validateRecognizedTimestamps, validateRecognizedNumbers, reportUnknownSegments, reportDuplicateControlId, and countFindingsBySeverity.
- ack.mjs: ACK_CATEGORIES and readErrSegments.
- HL7Toolkit.History.psm1: Assert-HL7SanitizedSchema and Write-HL7AtomicJson.
- HL7Toolkit.Mllp.psm1: Connect-HL7TcpClient, ConvertTo-HL7MllpFrame, Read-HL7MllpFrame, Write-HL7MllpFrame, New-HL7TransportResult, and Get-HL7SafeTransportCode.
