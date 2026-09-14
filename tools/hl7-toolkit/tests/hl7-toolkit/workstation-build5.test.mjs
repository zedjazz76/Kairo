import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { computeSourceSnapshotHash, verifyReleaseArchive, verifyReleaseManifest, verifyZipChecksum } from '../../verify-workstation-release.mjs';

test('Build 5 manifest verifier accepts a complete manifest and rejects changed files', () => {
  const root = mkdtempSync(join(tmpdir(), 'kairo-win5-manifest-'));
  try {
    mkdirSync(join(root, 'app', 'scripts'), { recursive: true });
    const path = join(root, 'app', 'scripts', 'image-content.mjs');
    writeFileSync(path, 'synthetic accepted sanitizer');
    const bytes = readFileSync(path);
    writeFileSync(join(root, 'RELEASE-MANIFEST.json'), JSON.stringify({
      product: 'Kairo HL7 Toolkit', version: '0.7.3', runtimeBuild: 5,
      files: [{ path: 'app/scripts/image-content.mjs', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }],
    }));
    assert.equal(verifyReleaseManifest(root).fileCount, 1);
    writeFileSync(path, 'different sanitizer');
    assert.throws(() => verifyReleaseManifest(root), /MANIFEST_MISMATCH/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('published Build 5 uses the current accepted sanitizer and local OCR assets', () => {
  const root = 'dist/Kairo-HL7-Toolkit-v0.7.3-win5';
  const manifest = verifyReleaseManifest(root);
  assert.ok(manifest.fileCount > 200);
  for (const path of ['scripts/image-content.mjs', 'scripts/image-sanitize-ui.mjs', 'scripts/image-phi-assist.mjs', 'ocr/tesseract.esm.min.js', 'ocr/worker.min.js', 'ocr/tesseract-core-lstm.wasm.js', 'ocr/tesseract-core-lstm.wasm', 'ocr/lang/eng.traineddata.gz']) {
    assert.deepEqual(readFileSync(`${root}/app/${path}`), readFileSync(`hl7-toolkit/app/${path}`), path);
  }
  assert.equal(verifyZipChecksum(`${root}.zip`, `${root}.zip.sha256`), true);
  const version = readFileSync(`${root}/VERSION.txt`, 'utf8');
  assert.match(version, /Feature Version: 0\.7\.3/);
  assert.match(version, /Workstation Runtime Build: 5/);
  const published = JSON.parse(readFileSync(`${root}/RELEASE-MANIFEST.json`, 'utf8'));
  assert.equal(published.sourceSnapshotSha256, computeSourceSnapshotHash('.'));
  assert.equal(verifyReleaseArchive(root, `${root}.zip`, `${root}.zip.sha256`, { unzipBin: process.env.UNZIP_BIN || 'unzip' }).fileCount, manifest.fileCount);
});

test('Build 5 contains no runtime launch scripts, tests, manual images, or runtime data', () => {
  const root = 'dist/Kairo-HL7-Toolkit-v0.7.3-win5';
  const files = JSON.parse(readFileSync(`${root}/RELEASE-MANIFEST.json`, 'utf8')).files.map(file => file.path);
  assert.ok(files.includes('Kairo.Helper.exe'));
  assert.ok(files.includes('coreclr.dll'));
  assert.ok(files.includes('hostfxr.dll'));
  assert.deepEqual(readdirSync(`${root}/data/runtime`), []);
  for (const path of files) assert.doesNotMatch(path, /(?:^|\/)(?:tests?|fixtures?)(?:\/|$)|(?:\.ps1|\.psm1|\.cmd|\.log|\.pdb|\.cs|\.zip)$|image-sanitize-browser-check/i);
  assert.deepEqual(files.filter(path => /\.(?:png|jpe?g)$/i.test(path)), ['app/assets/kairo-guardian.png']);
});

test('Build 5 release builder refuses to overwrite its published target', () => {
  const zip = 'dist/Kairo-HL7-Toolkit-v0.7.3-win5.zip';
  const before = createHash('sha256').update(readFileSync(zip)).digest('hex');
  const result = spawnSync('bash', ['build-workstation-runtime.sh'], { cwd: '.', encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Build 5 target already exists; refusing to overwrite release artifacts/);
  assert.equal(createHash('sha256').update(readFileSync(zip)).digest('hex'), before);
});
