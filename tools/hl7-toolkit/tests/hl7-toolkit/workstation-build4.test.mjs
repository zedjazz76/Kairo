import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import * as release from '../../verify-workstation-release.mjs';
import { verifyReleaseManifest, verifyZipChecksum } from '../../verify-workstation-release.mjs';

test('historical Build 4 keeps its own identity after the release tooling advances', () => {
  const root = 'dist/Kairo-HL7-Toolkit-v0.7.3-win4';
  const version = readFileSync(`${root}/VERSION.txt`, 'utf8');
  const manifest = JSON.parse(readFileSync(`${root}/RELEASE-MANIFEST.json`, 'utf8'));
  assert.match(version, /Feature Version: 0\.7\.3/);
  assert.match(version, /Workstation Runtime Build: 4/);
  assert.equal(manifest.runtimeBuild, 4);
  assert.match(readFileSync(`${root}/README-RUN.txt`, 'utf8'), /Unknown Publisher|SmartScreen/);
});

test('historical Build 4 remains independently verifiable and untouched', () => {
  const root = 'dist/Kairo-HL7-Toolkit-v0.7.3-win4';
  const manifest = verifyReleaseManifest(root);
  assert.ok(manifest.fileCount > 200);
  assert.equal(verifyZipChecksum(`${root}.zip`, `${root}.zip.sha256`), true);
  assert.equal(release.verifyReleaseArchive(root, `${root}.zip`, `${root}.zip.sha256`, { unzipBin: process.env.UNZIP_BIN || 'unzip' }).fileCount, manifest.fileCount);
});

test('manifest verifier rejects tampering, omitted assets, and unlisted files', () => {
  const root = mkdtempSync(join(tmpdir(), 'kairo-manifest-test-'));
  try {
    mkdirSync(join(root, 'app', 'scripts'), { recursive: true });
    writeFileSync(join(root, 'app', 'scripts', 'image-content.mjs'), 'synthetic source');
    const bytes = readFileSync(join(root, 'app', 'scripts', 'image-content.mjs'));
    const manifest = { product: 'Kairo HL7 Toolkit', version: '0.7.3', runtimeBuild: 4, files: [{ path: 'app/scripts/image-content.mjs', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }] };
    writeFileSync(join(root, 'RELEASE-MANIFEST.json'), JSON.stringify(manifest));
    assert.equal(verifyReleaseManifest(root).fileCount, 1);
    writeFileSync(join(root, 'app', 'scripts', 'image-content.mjs'), 'tampered');
    assert.throws(() => verifyReleaseManifest(root), /MANIFEST_MISMATCH/);
    writeFileSync(join(root, 'app', 'scripts', 'image-content.mjs'), bytes);
    writeFileSync(join(root, 'extra.log'), 'synthetic');
    assert.throws(() => verifyReleaseManifest(root), /MANIFEST_MISMATCH/);
    rmSync(join(root, 'extra.log'));
    writeFileSync(join(root, 'app', 'scripts', 'RELEASE-MANIFEST.json'), 'hidden extra');
    assert.throws(() => verifyReleaseManifest(root), /MANIFEST_MISMATCH/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('ZIP checksum verifier requires the exact ZIP basename and digest', () => {
  const root = mkdtempSync(join(tmpdir(), 'kairo-checksum-test-'));
  try {
    const zip = join(root, 'Kairo-HL7-Toolkit-v0.7.3-win4.zip');
    const sha = `${zip}.sha256`;
    writeFileSync(zip, 'synthetic zip bytes');
    writeFileSync(sha, `${createHash('sha256').update('synthetic zip bytes').digest('hex')}  Kairo-HL7-Toolkit-v0.7.3-win4.zip\n`);
    assert.equal(verifyZipChecksum(zip, sha), true);
    writeFileSync(sha, `${'0'.repeat(64)}  Kairo-HL7-Toolkit-v0.7.3-win4.zip\n`);
    assert.throws(() => verifyZipChecksum(zip, sha), /ZIP_CHECKSUM_MISMATCH/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('archive verifier rejects changed ZIP content even when its checksum is updated', () => {
  const root = mkdtempSync(join(tmpdir(), 'kairo-archive-test-'));
  const name = 'Kairo-HL7-Toolkit-v0.7.3-win4';
  const folder = join(root, name);
  const zip = join(root, `${name}.zip`);
  const sha = `${zip}.sha256`;
  const zipBin = process.env.ZIP_BIN || 'zip';
  const unzipBin = process.env.UNZIP_BIN || 'unzip';
  try {
    mkdirSync(folder);
    writeFileSync(join(folder, 'VERSION.txt'), 'synthetic version');
    const bytes = readFileSync(join(folder, 'VERSION.txt'));
    writeFileSync(join(folder, 'RELEASE-MANIFEST.json'), JSON.stringify({ product: 'Kairo HL7 Toolkit', version: '0.7.3', runtimeBuild: 4, files: [{ path: 'VERSION.txt', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }] }));
    assert.equal(spawnSync(zipBin, ['-q', '-r', zip, name], { cwd: root }).status, 0);
    const checksum = () => writeFileSync(sha, `${createHash('sha256').update(readFileSync(zip)).digest('hex')}  ${name}.zip\n`);
    checksum();
    assert.equal(release.verifyReleaseArchive(folder, zip, sha, { unzipBin }).fileCount, 1);
    writeFileSync(join(folder, 'extra.txt'), 'unlisted data');
    assert.equal(spawnSync(zipBin, ['-q', '-u', zip, `${name}/extra.txt`], { cwd: root }).status, 0);
    rmSync(join(folder, 'extra.txt'));
    checksum();
    assert.throws(() => release.verifyReleaseArchive(folder, zip, sha, { unzipBin }), /ARCHIVE_MISMATCH/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
