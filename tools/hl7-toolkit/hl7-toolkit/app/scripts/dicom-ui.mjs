import { explainUid, findDicomTag, parseDicomMetadata, summarizeDicom, validateDicomMetadata } from './dicom-core.mjs';
export function mountDicom(root) {
  const $ = (s) => root.querySelector(s);
  const render = (metadata) => {
    const rows = Object.entries(metadata).map(([key, value]) => { const tag = findDicomTag(key); return '<tr><td>' + (tag ? tag.name : key) + '</td><td>' + value + '</td><td>' + (tag?.vr || '') + '</td></tr>'; }).join('');
    $('#dicom-tags').innerHTML = '<table><tr><th>Tag</th><th>Value</th><th>VR</th></tr>' + rows + '</table>';
    const summary = summarizeDicom(metadata); $('#dicom-summary').textContent = 'Object type: ' + summary.objectType + ' · Patient ID: ' + (summary.patientId || 'not available') + ' · Accession: ' + (summary.accession || 'not available');
    $('#dicom-findings').textContent = validateDicomMetadata(metadata).map((f) => f.severity.toUpperCase() + ' · ' + f.code + ' · ' + f.summary).join('\n') || 'No baseline metadata concerns.';
    $('#dicom-uid').textContent = metadata.SOPClassUID ? explainUid(metadata.SOPClassUID).name : 'SOP Class UID not available.';
  };
  $('#dicom-file').addEventListener('change', async (event) => { const file = event.target.files[0]; if (!file) return; render(parseDicomMetadata(await file.arrayBuffer())); $('#dicom-status').textContent = 'Read locally from ' + file.name + '. Pixels were not rendered or uploaded.'; });
  $('#dicom-search').addEventListener('input', () => { const tag = findDicomTag($('#dicom-search').value); $('#dicom-definition').textContent = tag ? tag.name + ' (' + tag.keyword + ') · VR ' + tag.vr + ' · VM ' + tag.vm + ' · ' + tag.category : 'No supported standard tag found.'; });
}
