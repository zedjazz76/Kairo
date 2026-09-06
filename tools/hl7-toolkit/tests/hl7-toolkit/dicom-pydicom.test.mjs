import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseDicomMetadata } from '../../hl7-toolkit/app/scripts/dicom-core.mjs';
import { mountDicom } from '../../hl7-toolkit/app/scripts/dicom-ui.mjs';

for (const [name, size, modality, sop, count] of [
  ['CT_small.dcm', 39206, 'CT', '1.2.840.10008.5.1.4.1.1.2', 20],
  ['MR_small.dcm', 9830, 'MR', '1.2.840.10008.5.1.4.1.1.4', 19],
]) {
  test(`${name}: complete binary File reaches parser and production rendering`, async () => {
    const bytes = await readFile(new URL(`./fixtures/pydicom/${name}`, import.meta.url));
    const file = new File([bytes], name, { type: 'application/dicom' });
    assert.equal(file.size, size);
    const buffer = await file.arrayBuffer();
    assert.equal(buffer.byteLength, size);
    assert.deepEqual(Buffer.from(buffer), bytes);
    assert.equal(bytes.subarray(128, 132).toString(), 'DICM');
    const metadata = parseDicomMetadata(buffer);
    assert.equal(Object.keys(metadata).length, count);
    assert.equal(metadata.Modality, modality);
    assert.equal(metadata.SOPClassUID, sop);
    assert.equal(metadata.TransferSyntaxUID, '1.2.840.10008.1.2.1');
    for (const key of ['StudyInstanceUID', 'SeriesInstanceUID', 'SOPInstanceUID', 'PatientID']) assert.ok(metadata[key], key);
    // Both upstream fixtures deliberately carry an empty accession element.
    assert.equal(metadata.AccessionNumber, '');
    const html = await readFile(new URL('../../hl7-toolkit/app/index.html', import.meta.url), 'utf8');
    const nodes = new Map();
    const root = { querySelector(selector) {
      assert.ok(html.includes(`id="${selector.slice(1)}"`), selector);
      if (!nodes.has(selector)) nodes.set(selector, { listeners: {}, textContent: '', innerHTML: '', addEventListener(type, listener) { this.listeners[type] = listener; } });
      return nodes.get(selector);
    } };
    mountDicom(root);
    await root.querySelector('#dicom-file').listeners.change({ target: { files: [file] } });
    assert.equal((root.querySelector('#dicom-tags').innerHTML.match(/<tr>/g) || []).length, count + 1);
    assert.match(root.querySelector('#dicom-uid').textContent, new RegExp(`${modality} Image Storage`));
    assert.match(root.querySelector('#dicom-uid').textContent, /Explicit VR Little Endian/);
    for (const key of ['StudyInstanceUID', 'SeriesInstanceUID', 'SOPInstanceUID']) assert.ok(root.querySelector('#dicom-tags').innerHTML.includes(metadata[key]), key);
    assert.ok(root.querySelector('#dicom-tags').innerHTML.includes(`<td>Modality</td><td>${modality}</td>`));
    assert.match(root.querySelector('#dicom-status').textContent, /Read locally/);
  });
}
