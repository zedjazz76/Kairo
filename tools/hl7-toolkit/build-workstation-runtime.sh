#!/usr/bin/env bash
set -euo pipefail

toolkit_root=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
repo_root=$(cd "$toolkit_root/../.." && pwd -P)
dotnet_bin=${DOTNET_BIN:-dotnet}
release_name=Kairo-HL7-Toolkit-v0.7.3-win1
dist_root="$toolkit_root/dist"
release_root="$dist_root/$release_name"
zip_path="$dist_root/$release_name.zip"
publish_root=$(mktemp -d)
extract_root=$(mktemp -d)
trap 'rm -rf "$publish_root" "$extract_root"' EXIT

if [[ $(git -C "$repo_root" rev-parse HEAD) != 714e5c9d24a471f0c39e95e65441d2416e65ad53 ]]; then
  echo "Source checkpoint is not the accepted 714e5c9 checkpoint." >&2
  exit 1
fi

rm -rf "$release_root"
mkdir -p "$release_root/data/runtime" "$dist_root"
"$dotnet_bin" publish "$toolkit_root/runtime/Kairo.Helper/Kairo.Helper.csproj" \
  --configuration Release --runtime win-x64 --self-contained true \
  -p:PublishSingleFile=false -p:PublishAot=false -p:DebugType=None -p:DebugSymbols=false \
  --output "$publish_root/publish"
cp -a "$publish_root/publish/." "$release_root/"
cp -a "$toolkit_root/hl7-toolkit/app" "$release_root/app"

printf '%s\n' \
  'Product: Kairo HL7 Toolkit' \
  'Version: 0.7.3' \
  'Workstation Runtime Build: 1' \
  'Release Type: Workstation Runtime' \
  'Source Commit: 714e5c9d24a471f0c39e95e65441d2416e65ad53' \
  'Runtime Identifier: win-x64' \
  'Publish Model: Self-contained folder' > "$release_root/VERSION.txt"

printf '%s\n' \
  'Kairo HL7 Toolkit v0.7.3 - Workstation Runtime Build 1' \
  '' \
  '1. Extract this complete folder to a user-writable location.' \
  '2. Double-click Kairo.Helper.exe. Do not move the executable out of this folder.' \
  '3. Kairo opens in the default browser and listens only on 127.0.0.1.' \
  '4. Close the helper window when finished. Use Clear or End Session for browser-held data.' \
  '' \
  'No PowerShell, administrator access, installer, or separately installed .NET runtime is required.' > "$release_root/README-RUN.txt"

printf '%s\n' \
  '# Kairo HL7 Toolkit v0.7.3 - Workstation Runtime Build 1' \
  '' \
  '- Replaces the workstation PowerShell host with direct-launch Kairo.Helper.exe.' \
  '- Preserves the accepted v0.7.3 browser, API, security, persistence, and protocol behavior.' \
  '- This is a runtime packaging release, not feature version 0.7.4.' > "$release_root/RELEASE-NOTES.md"

if find "$release_root" -type f \( -iname '*.ps1' -o -iname '*.psm1' -o -iname '*.cmd' -o -iname '*.cs' -o -iname '*.pdb' \) -print -quit | grep -q .; then
  echo 'Forbidden script/source/debug artifact in release.' >&2
  exit 1
fi
if rg -a -l '/home/zedjazz|Projects/Kairo|^-----BEGIN (RSA |EC |OPENSSH )?(PRIVATE KEY|CERTIFICATE)-----$' "$release_root" >/dev/null; then
  echo 'Developer path, credential, or certificate canary in release.' >&2
  exit 1
fi

RELEASE_ROOT="$release_root" node <<'NODE'
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
  product: 'Kairo HL7 Toolkit', version: '0.7.3', runtimeBuild: 1,
  releaseType: 'Workstation Runtime', sourceCommit: '714e5c9d24a471f0c39e95e65441d2416e65ad53',
  runtimeIdentifier: 'win-x64', publishModel: 'self-contained folder', files
};
fs.writeFileSync(path.join(root, 'RELEASE-MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
NODE

zip_bin=${ZIP_BIN:-/home/zedjazz/.local/share/kairo-release-tools/usr/bin/zip}
unzip_bin=${UNZIP_BIN:-/home/zedjazz/.local/share/kairo-release-tools/usr/bin/unzip}
rm -f "$zip_path" "$zip_path.sha256"
(cd "$dist_root" && "$zip_bin" -q -r "$zip_path" "$release_name")
(cd "$dist_root" && sha256sum "$(basename "$zip_path")") > "$zip_path.sha256.tmp"
mv "$zip_path.sha256.tmp" "$zip_path.sha256"
"$unzip_bin" -q "$zip_path" -d "$extract_root"
cmp "$release_root/RELEASE-MANIFEST.json" "$extract_root/$release_name/RELEASE-MANIFEST.json"
echo "$release_root"
