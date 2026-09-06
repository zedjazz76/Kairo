import { explainUid, findDicomTag, parseDicomMetadata, redactDicomMetadata, summarizeDicom, validateDicomMetadata } from './dicom-core.mjs';
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
export function mountDicom(root, { clipboard = globalThis.navigator?.clipboard } = {}) {
  const $ = (s) => root.querySelector(s);
  let redactedText = '';
  let selection = 0;
  let copying = false;
  const updateCopy = () => { $('#dicom-copy').disabled = !redactedText || !$('#dicom-reviewed').checked || copying; };
  const clearCopy = () => {
    redactedText = '';
    $('#dicom-redacted').value = '';
    $('#dicom-reviewed').checked = false;
    $('#dicom-reviewed').disabled = true;
    $('#dicom-copy-status').textContent = 'Load a DICOM file to prepare a preview.';
    updateCopy();
  };
  clearCopy();
  $('#dicom-reviewed').addEventListener('change', updateCopy);
  $('#dicom-copy').addEventListener('click', async () => {
    if (!redactedText || !$('#dicom-reviewed').checked || copying) return;
    const currentSelection = selection;
    copying = true;
    updateCopy();
    try {
      await clipboard.writeText(redactedText);
      if (currentSelection === selection) $('#dicom-copy-status').textContent = 'Copied redacted summary.';
    } catch {
      if (currentSelection === selection) $('#dicom-copy-status').textContent = 'Clipboard unavailable. Select the reviewed preview and copy it manually.';
    } finally {
      copying = false;
      updateCopy();
    }
  });
  const render = (metadata) => {
    const rows = Object.entries(metadata).map(([key, value]) => { const tag = findDicomTag(key); return '<tr><td>' + escapeHtml(tag ? tag.name : key) + '</td><td>' + escapeHtml(value) + '</td><td>' + escapeHtml(tag?.vr || '') + '</td></tr>'; }).join('');
    $('#dicom-tags').innerHTML = '<table><tr><th>Tag</th><th>Value</th><th>VR</th></tr>' + rows + '</table>';
    const summary = summarizeDicom(metadata); $('#dicom-summary').textContent = 'Object type: ' + summary.objectType + ' · Patient ID: ' + (summary.patientId || 'not available') + ' · Accession: ' + (summary.accession || 'not available');
    $('#dicom-findings').textContent = validateDicomMetadata(metadata).map((f) => f.severity.toUpperCase() + ' · ' + f.code + ' · ' + f.summary).join('\n') || 'No baseline metadata concerns.';
    $('#dicom-uid').textContent = metadata.SOPClassUID ? explainUid(metadata.SOPClassUID).name : 'SOP Class UID not available.';
    $('#dicom-uid').textContent += ' · Transfer Syntax: ' + (metadata.TransferSyntaxUID ? explainUid(metadata.TransferSyntaxUID).name + ' (' + metadata.TransferSyntaxUID + ')' : 'not available');
  };
  $('#dicom-file').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const currentSelection = ++selection;
    clearCopy();
    for (const id of ['#dicom-summary', '#dicom-findings', '#dicom-uid']) $(id).textContent = '';
    $('#dicom-tags').innerHTML = '';
    $('#dicom-status').textContent = 'Reading local DICOM metadata…';
    try {
      const metadata = parseDicomMetadata(await file.arrayBuffer());
      if (currentSelection !== selection) return;
      if (!Object.keys(metadata).length) throw new Error('NO_SUPPORTED_METADATA');
      render(metadata);
      redactedText = redactDicomMetadata(metadata);
      $('#dicom-redacted').value = redactedText;
      $('#dicom-reviewed').disabled = false;
      $('#dicom-copy-status').textContent = 'Review the preview, then confirm before copying.';
      $('#dicom-status').textContent = 'Read locally from ' + file.name + '. Pixels were not rendered or uploaded.';
    } catch {
      if (currentSelection === selection) $('#dicom-status').textContent = 'Could not read supported DICOM metadata. Select an Explicit VR Little Endian file.';
    }
  });
  $('#dicom-search').addEventListener('input', () => { const tag = findDicomTag($('#dicom-search').value); $('#dicom-definition').textContent = tag ? tag.name + ' (' + tag.keyword + ') · VR ' + tag.vr + ' · VM ' + tag.vm + ' · ' + tag.category : 'No supported standard tag found.'; });
}
