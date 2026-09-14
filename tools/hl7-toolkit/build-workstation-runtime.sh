#!/usr/bin/env bash
set -euo pipefail

toolkit_root=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(cd "$toolkit_root/../.." && pwd -P)
dotnet_bin=${DOTNET_BIN:-dotnet}
release_name=Kairo-HL7-Toolkit-v0.7.3-win5
dist_root="$toolkit_root/dist"
release_root="$dist_root/$release_name"
zip_path="$dist_root/$release_name.zip"
publish_root=$(mktemp -d)
trap 'rm -rf "$publish_root"' EXIT
stage_root="$publish_root/$release_name"
stage_zip="$publish_root/$release_name.zip"
stage_sha="$publish_root/$release_name.zip.sha256"

source_base_commit=$(git -C "$repo_root" rev-parse HEAD)
if ! git -C "$repo_root" merge-base --is-ancestor 122eb988bfa3cd8d55c74226c584b0e0f1bbcaa7 "$source_base_commit"; then
  echo "Source does not contain the accepted Workstation Runtime Build 1 checkpoint." >&2
  exit 1
fi

mkdir -p "$dist_root"
if [[ -e "$release_root" || -e "$zip_path" || -e "$zip_path.sha256" ]]; then
  echo 'Build 5 target already exists; refusing to overwrite release artifacts.' >&2
  exit 1
fi
source_snapshot_sha256=$(node "$toolkit_root/verify-workstation-release.mjs" --source-hash "$toolkit_root")
mkdir -p "$stage_root/data/runtime"
"$dotnet_bin" publish "$toolkit_root/runtime/Kairo.Helper/Kairo.Helper.csproj" \
  --configuration Release --runtime win-x64 --self-contained true \
  -p:PublishSingleFile=false -p:PublishAot=false -p:DebugType=None -p:DebugSymbols=false \
  --output "$publish_root/publish"
cp -a "$publish_root/publish/." "$stage_root/"
cp -a "$toolkit_root/hl7-toolkit/app" "$stage_root/app"
test -f "$stage_root/Kairo.Helper.exe"
test -f "$stage_root/coreclr.dll"
test -f "$stage_root/hostfxr.dll"
test -f "$stage_root/app/scripts/image-sanitize-ui.mjs"
test -f "$stage_root/app/scripts/image-content.mjs"
test -f "$stage_root/app/scripts/segment-help.mjs"
test -f "$stage_root/app/definitions/hl7-segments.v1.json"
test -f "$stage_root/app/ocr/tesseract.esm.min.js"
test -f "$stage_root/app/ocr/worker.min.js"
test -f "$stage_root/app/ocr/tesseract-core-lstm.wasm.js"
test -f "$stage_root/app/ocr/tesseract-core-lstm.wasm"
test -f "$stage_root/app/ocr/lang/eng.traineddata.gz"

printf '%s\n' \
  'Product: Kairo HL7 Toolkit' \
  'Feature Version: 0.7.3' \
  'Workstation Runtime Build: 5' \
  'Release Type: Workstation Runtime' \
  'Source Feature Checkpoint: 714e5c9d24a471f0c39e95e65441d2416e65ad53' \
  "Source Base Commit: $source_base_commit" \
  "Source Snapshot SHA-256: $source_snapshot_sha256" \
  'Release Status: Ready for work-desktop transfer after laptop manual acceptance' \
  'Runtime Identifier: win-x64' \
  'Publish Model: Self-contained folder' > "$stage_root/VERSION.txt"

printf '%s\n' \
  'Kairo HL7 Toolkit v0.7.3 - Workstation Runtime Build 5' \
  '' \
  '1. Extract this complete folder to a user-writable location.' \
  '2. Double-click Kairo.Helper.exe. Do not move the executable out of this folder.' \
  '3. Kairo opens in the default browser and listens only on 127.0.0.1.' \
  '4. Close the helper window when finished. Use Clear or End Session for browser-held data.' \
  '' \
  'No PowerShell, administrator access, installer, or separately installed .NET runtime is required.' \
  'The executable is unsigned. Windows may show Unknown Publisher or SmartScreen; follow your organization’s approval process. No security bypass is included.' > "$stage_root/README-RUN.txt"

printf '%s\n' \
  '# Kairo HL7 Toolkit v0.7.3 - Workstation Runtime Build 5' \
  '' \
  '- Real Windows manual acceptance passed for local OCR and Image Extract & Sanitize in the normal authenticated runtime, including patient names, MRN/Patient ID, accession, supported dates, consistent placeholders, text mode, table/cell mode, and preserved non-PHI clinical text.' \
  '- The original image remains unchanged. Optional pixel-redacted image output remains secondary.' \
  '- Tesseract.js 6.0.1, compatible worker and core 6.1.2, and English language data are bundled locally; no cloud OCR or external runtime is required.' \
  '- Preserves Stage 1–7.3 functionality, HL7 segment-purpose help, and direct-launch Kairo.Helper.exe.' \
  '- Automated extraction and identifier detection may miss information. Review sanitized output before sharing; no PHI-free or de-identification guarantee is made.' \
  '- DICOM image sanitization is not included.' \
  '- Build 1 remains the accepted baseline; Build 2 failed manual acceptance; Build 3 was a temporary overlaid test runtime; Build 4 is unaccepted and not reused. Build 5 is a fresh package from the accepted source tree.' \
  '- The executable is unsigned and may show Unknown Publisher or SmartScreen; no security bypass is included.' \
  '- This is a workstation runtime build of feature version 0.7.3, not 0.7.4.' > "$stage_root/RELEASE-NOTES.md"

if find "$stage_root" -type l -print -quit | grep -q .; then
  echo 'Linked file or directory in release.' >&2
  exit 1
fi
if find "$stage_root" -type f \( -iname '*.ps1' -o -iname '*.psm1' -o -iname '*.cmd' -o -iname '*.cs' -o -iname '*.pdb' -o -iname '*.log' \) -print -quit | grep -q .; then
  echo 'Forbidden runtime script, source, debug artifact, or log in release.' >&2
  exit 1
fi
if find "$stage_root" \( -path '*/tests/*' -o -path '*/fixtures/*' -o -name 'image-sanitize-browser-check.mjs' \) -print -quit | grep -q .; then
  echo 'Test fixture or harness in release.' >&2
  exit 1
fi
if rg -a -l '/home/zedjazz|Projects/Kairo|/mnt/[a-z]/|\\\\wsl\$|^-----BEGIN (RSA |EC |OPENSSH )?(PRIVATE KEY|CERTIFICATE)-----$' "$stage_root" >/dev/null; then
  echo 'Developer path, WSL path, credential, or certificate canary in release.' >&2
  exit 1
fi
test -z "$(find "$stage_root/data/runtime" -type f -print -quit)"

RELEASE_ROOT="$stage_root" SOURCE_BASE_COMMIT="$source_base_commit" SOURCE_SNAPSHOT_SHA256="$source_snapshot_sha256" node <<'NODE'
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = process.env.RELEASE_ROOT;
const walk = dir => fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
  const full = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(full) : [full];
});
const files = walk(root).filter(file => path.basename(file) !== 'RELEASE-MANIFEST.json').sort().map(file => {
  const bytes = fs.readFileSync(file);
  return { path: path.relative(root, file).split(path.sep).join('/'), size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
});
const manifest = {
  product: 'Kairo HL7 Toolkit', version: '0.7.3', runtimeBuild: 5,
  releaseType: 'Workstation Runtime', sourceCheckpoint: '714e5c9d24a471f0c39e95e65441d2416e65ad53',
  sourceBaseCommit: process.env.SOURCE_BASE_COMMIT, sourceSnapshotSha256: process.env.SOURCE_SNAPSHOT_SHA256,
  candidateStatus: 'ready-for-work-desktop-transfer',
  runtimeIdentifier: 'win-x64', publishModel: 'self-contained folder', files
};
fs.writeFileSync(path.join(root, 'RELEASE-MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
NODE

zip_bin=${ZIP_BIN:-zip}
unzip_bin=${UNZIP_BIN:-unzip}
(cd "$publish_root" && "$zip_bin" -q -r "$stage_zip" "$release_name")
(cd "$publish_root" && sha256sum "$release_name.zip") > "$stage_sha"
UNZIP_BIN="$unzip_bin" node "$toolkit_root/verify-workstation-release.mjs" "$stage_root" "$stage_zip" "$stage_sha"
if [[ -e "$release_root" || -e "$zip_path" || -e "$zip_path.sha256" ]]; then
  echo 'Build 5 target appeared during staging; refusing to overwrite release artifacts.' >&2
  exit 1
fi
mv -T "$stage_root" "$release_root"
mv -T "$stage_zip" "$zip_path"
mv -T "$stage_sha" "$zip_path.sha256"
echo "$release_root"
