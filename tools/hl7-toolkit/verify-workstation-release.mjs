import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function walk(directory, skipped = new Set()) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (lstatSync(path).isSymbolicLink()) throw new Error('MANIFEST_MISMATCH');
    if (entry.isDirectory()) { if (!skipped.has(entry.name)) files.push(...walk(path, skipped)); }
    else if (entry.isFile()) files.push(path);
    else throw new Error('MANIFEST_MISMATCH');
  }
  return files;
}

export function computeSourceSnapshotHash(toolkitRoot) {
  const app = walk(join(toolkitRoot, 'hl7-toolkit', 'app'));
  const helper = walk(join(toolkitRoot, 'runtime', 'Kairo.Helper'), new Set(['bin', 'obj']))
    .filter(path => /\.(?:cs|csproj|manifest)$/.test(path));
  const linked = ['EndpointDiagnostics.cs', 'HttpTlsDiagnostics.cs', 'DicomQueryDiagnostics.cs']
    .map(name => join(toolkitRoot, 'hl7-toolkit', 'service', name));
  const files = [...app, ...helper, ...linked, join(toolkitRoot, 'build-workstation-runtime.sh'), join(toolkitRoot, 'verify-workstation-release.mjs')]
    .sort((a, b) => a.localeCompare(b));
  const digest = createHash('sha256');
  for (const file of files) digest.update(relative(toolkitRoot, file).split(sep).join('/')).update('\0').update(sha256(readFileSync(file))).update('\n');
  return digest.digest('hex');
}

export function verifyReleaseManifest(root) {
  const manifest = JSON.parse(readFileSync(join(root, 'RELEASE-MANIFEST.json'), 'utf8'));
  if (manifest.product !== 'Kairo HL7 Toolkit' || manifest.version !== '0.7.3' || ![4, 5].includes(manifest.runtimeBuild) || !Array.isArray(manifest.files)) throw new Error('MANIFEST_MISMATCH');
  const actual = walk(root).filter(path => path !== join(root, 'RELEASE-MANIFEST.json'))
    .map(path => { const bytes = readFileSync(path); return { path: relative(root, path).split(sep).join('/'), size: bytes.length, sha256: sha256(bytes) }; })
    .sort((a, b) => a.path.localeCompare(b.path));
  const expected = [...manifest.files].sort((a, b) => String(a.path).localeCompare(String(b.path)));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('MANIFEST_MISMATCH');
  return { fileCount: actual.length };
}

export function verifyZipChecksum(zipPath, shaPath) {
  const line = readFileSync(shaPath, 'utf8');
  const match = /^([a-f0-9]{64})  ([^\r\n]+)\n?$/.exec(line);
  if (!match || match[2] !== basename(zipPath) || match[1] !== sha256(readFileSync(zipPath))) throw new Error('ZIP_CHECKSUM_MISMATCH');
  return true;
}

export function verifyReleaseArchive(root, zipPath, shaPath, { unzipBin = 'unzip' } = {}) {
  const { fileCount } = verifyReleaseManifest(root);
  verifyZipChecksum(zipPath, shaPath);
  const releaseName = basename(resolve(root));
  const entries = execFileSync(unzipBin, ['-Z1', zipPath], { encoding: 'utf8' }).trim().split('\n');
  const seen = new Set();
  for (const entry of entries) {
    const parts = entry.split('/');
    if (seen.has(entry) || parts[0] !== releaseName || parts.slice(1).some(part => part === '..' || part === '.') || entry.includes('\\') || !entry.startsWith(`${releaseName}/`)) throw new Error('ARCHIVE_MISMATCH');
    seen.add(entry);
  }
  const extractRoot = mkdtempSync(join(tmpdir(), 'kairo-release-verify-'));
  try {
    execFileSync(unzipBin, ['-q', zipPath, '-d', extractRoot]);
    if (readdirSync(extractRoot).length !== 1) throw new Error('ARCHIVE_MISMATCH');
    const extracted = join(extractRoot, releaseName);
    if (readFileSync(join(root, 'RELEASE-MANIFEST.json')).equals(readFileSync(join(extracted, 'RELEASE-MANIFEST.json'))) === false
      || verifyReleaseManifest(extracted).fileCount !== fileCount) throw new Error('ARCHIVE_MISMATCH');
  } catch { throw new Error('ARCHIVE_MISMATCH'); }
  finally { rmSync(extractRoot, { recursive: true, force: true }); }
  return { fileCount };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--source-hash') {
    if (!process.argv[3]) throw new Error('RELEASE_VERIFICATION_INPUT_REQUIRED');
    process.stdout.write(`${computeSourceSnapshotHash(process.argv[3])}\n`);
  } else {
    const [root, zipPath, shaPath] = process.argv.slice(2);
    if (!root || !zipPath || !shaPath) throw new Error('RELEASE_VERIFICATION_INPUT_REQUIRED');
    const { fileCount } = verifyReleaseArchive(root, zipPath, shaPath, { unzipBin: process.env.UNZIP_BIN || 'unzip' });
    process.stdout.write(`MANIFEST_VERIFIED=YES FILE_COUNT=${fileCount} ZIP_CONTENT_VERIFIED=YES ZIP_SHA256_VERIFIED=YES\n`);
  }
}
