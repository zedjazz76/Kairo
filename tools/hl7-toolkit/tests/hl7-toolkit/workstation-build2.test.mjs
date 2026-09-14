import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('previous win3 package remains an immutable v0.7.3 artifact', () => {
  const version = readFileSync('dist/Kairo-HL7-Toolkit-v0.7.3-win3/VERSION.txt', 'utf8');
  const manifest = JSON.parse(readFileSync('dist/Kairo-HL7-Toolkit-v0.7.3-win3/RELEASE-MANIFEST.json', 'utf8'));
  assert.match(version, /Workstation Runtime Build: 3/);
  assert.equal(manifest.version, '0.7.3');
  assert.equal(manifest.runtimeBuild, 3);
});

test('both local hosts permit blob image previews without widening network connections', () => {
  for (const path of ['runtime/Kairo.Helper/Hosting/LoopbackHost.cs', 'hl7-toolkit/service/HL7Toolkit.Security.psm1']) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, /script-src 'self' 'wasm-unsafe-eval'/);
    assert.match(source, /connect-src 'self'; img-src 'self' data: blob:/);
    assert.doesNotMatch(source, /connect-src[^;]*blob:|connect-src[^;]*\*/);
  }
});
