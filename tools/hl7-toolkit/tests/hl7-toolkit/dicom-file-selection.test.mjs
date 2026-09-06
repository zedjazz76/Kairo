import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { mountDicom } from '../../hl7-toolkit/app/scripts/dicom-ui.mjs';

// Synthetic Part 10 object, including the long-VR File Meta Information Version.
function element(group, tag, vr, value) {
  let bytes = typeof value === 'string' ? Buffer.from(value) : value;
  if (bytes.length % 2) bytes = Buffer.concat([bytes, Buffer.from(vr === 'UI' ? [0] : [32])]);
  const header = Buffer.alloc(vr === 'OB' ? 12 : 8);
  header.writeUInt16LE(group, 0); header.writeUInt16LE(tag, 2); header.write(vr, 4);
  if (vr === 'OB') header.writeUInt32LE(bytes.length, 8);
  else header.writeUInt16LE(bytes.length, 6);
  return Buffer.concat([header, bytes]);
}

test('selected local Part 10 File reaches the DICOM table, summary and findings', async () => {
  const expected = [
    [0x0002, 0x0010, 'UI', '1.2.840.10008.1.2.1', 'Transfer Syntax UID'],
    [0x0008, 0x0016, 'UI', '1.2.840.10008.5.1.4.1.1.2', 'SOP Class UID'],
    [0x0008, 0x0018, 'UI', '2.25.101', 'SOP Instance UID'],
    [0x0008, 0x0050, 'SH', 'SYNTH-ACC', 'Accession Number'],
    [0x0008, 0x0060, 'CS', 'CT', 'Modality'],
    [0x0010, 0x0010, 'PN', 'SYNTHETIC^PATIENT', 'Patient Name'],
    [0x0010, 0x0020, 'LO', 'SYNTH-ID', 'Patient ID'],
    [0x0020, 0x000d, 'UI', '2.25.102', 'Study Instance UID'],
    [0x0020, 0x000e, 'UI', '2.25.103', 'Series Instance UID'],
  ];
  const preamble = Buffer.alloc(132); preamble.write('DICM', 128);
  const bytes = Buffer.concat([preamble, element(2, 1, 'OB', Buffer.from([0, 1])), ...expected.map(([g, t, vr, v]) => element(g, t, vr, v))]);
  const file = new File([bytes], 'synthetic-ct.dcm', { type: 'application/dicom' });
  const html = await readFile(new URL('../../hl7-toolkit/app/index.html', import.meta.url), 'utf8');
  assert.match(html, /id="dicom-file" type="file" accept="\.dcm,application\/dicom"/);
  // Minimal DOM surface: run production listeners and rendering, without a browser/OS chooser.
  const nodes = new Map();
  const root = { querySelector(selector) {
    assert.ok(html.includes('id="' + selector.slice(1) + '"'));
    if (!nodes.has(selector)) nodes.set(selector, { textContent: '', innerHTML: '', listeners: {}, addEventListener(type, listener) { this.listeners[type] = listener; } });
    return nodes.get(selector);
  } };
  mountDicom(root);
  await root.querySelector('#dicom-file').listeners.change({ target: { files: [file] } });
  for (const [, , vr, value, label] of expected) {
    assert.ok(root.querySelector('#dicom-tags').innerHTML.includes(`<td>${label}</td><td>${value}</td><td>${vr}</td>`), label);
  }
  assert.match(root.querySelector('#dicom-uid').textContent, /CT Image Storage/);
  assert.match(root.querySelector('#dicom-uid').textContent, /Transfer Syntax: Explicit VR Little Endian/);
  assert.equal(root.querySelector('#dicom-summary').textContent, 'Object type: CT Image Storage · Patient ID: SYNTH-ID · Accession: SYNTH-ACC');
  assert.equal(root.querySelector('#dicom-findings').textContent, 'No baseline metadata concerns.');
  assert.equal(root.querySelector('#dicom-status').textContent, 'Read locally from synthetic-ct.dcm. Pixels were not rendered or uploaded.');
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), bytes);
});
