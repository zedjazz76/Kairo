import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('packaged browser runtime permits the bundled OCR WebAssembly engine', () => {
  const host = readFileSync('runtime/Kairo.Helper/Hosting/LoopbackHost.cs', 'utf8');
  assert.match(host, /script-src 'self' 'wasm-unsafe-eval'/);
});

test('packaged helper CSP permits the same-origin classic OCR worker without blob permission', () => {
  const dll = readFileSync('dist/Kairo-HL7-Toolkit-v0.7.3-win3/Kairo.Helper.dll');
  const start = dll.indexOf(Buffer.from("default-src 'self';", 'utf16le'));
  const policy = start < 0 ? null : dll.subarray(start, start + 1000).toString('utf16le').match(/default-src 'self'; script-src 'self' 'wasm-unsafe-eval';[^\0]*?form-action 'none'/)?.[0];
  assert.ok(policy, 'packaged helper must contain its CSP');
  const directives = new Map(policy.split(';').map(part => { const [name, ...sources] = part.trim().split(/\s+/); return [name, sources.join(' ')]; }));
  const workerSources = directives.get('worker-src') || directives.get('child-src') || directives.get('script-src') || directives.get('default-src');
  assert.match(workerSources, /(?:^|\s)'self'(?:\s|$)/);
  assert.doesNotMatch(workerSources, /(?:^|\s)blob:(?:\s|$)/);
});

test('actual-browser packaged regression exercises OCR through rendered candidate state', () => {
  const harness = readFileSync('tests/hl7-toolkit/helpers/image-sanitize-browser-check.mjs', 'utf8');
  assert.match(harness, /PATIENT: TEST PATIENT/);
  assert.match(harness, /MRN: TEST123456/);
  assert.match(harness, /ACCESSION: TESTACC001/);
  assert.match(harness, /DOB: 19800101/);
  assert.match(harness, /PHYSICIAN: TEST DOCTOR/);
  assert.match(harness, /OCR_INITIALIZED/);
  assert.match(harness, /OCR_REGION_COUNT/);
  assert.match(harness, /PHI_CANDIDATE_COUNT/);
  assert.match(harness, /UI_CANDIDATES_RENDERED/);
  assert.doesNotMatch(harness, /createLocalOcrAdapter/);
});

test('packaged browser regression launches the native win3 runtime', () => {
  const harness = readFileSync('tests/hl7-toolkit/helpers/image-sanitize-browser-check.mjs', 'utf8');
  const packageManifest = readFileSync('dist/Kairo-HL7-Toolkit-v0.7.3-win3/RELEASE-MANIFEST.json', 'utf8');
  assert.match(harness, /Kairo\.Helper\.exe/);
  assert.match(harness, /spawn\(executable/);
  assert.doesNotMatch(harness, /powershell\.exe|pwsh\.exe|\.ps1|\.psm1|ExecutionPolicy|--no-browser/);
  assert.match(packageManifest, /"runtimeBuild": 3/);
  assert.match(packageManifest, /"runtimeIdentifier": "win-x64"/);
});

test('packaged browser regression explicitly navigates the debuggable Chrome page', () => {
  const harness = readFileSync('tests/hl7-toolkit/helpers/image-sanitize-browser-check.mjs', 'utf8');
  assert.match(harness, /Page\.navigate/);
  assert.match(harness, /url: appUrl/);
  assert.match(harness, /Page\.loadEventFired|document\.readyState/);
  assert.doesNotMatch(harness, /item\.url\.startsWith\(appUrl\)/);
});
