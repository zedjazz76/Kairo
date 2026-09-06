// Run with Node on the same OS as Chrome, against the actual launched toolkit.
// Chrome must use a separate test profile and --remote-debugging-port=9222.
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const debugUrl = process.argv[2] || 'http://127.0.0.1:9222';
const appUrl = process.argv[3] || 'http://127.0.0.1:8765/';
const pages = await (await fetch(debugUrl + '/json/list')).json();
const page = pages.find(page => page.url.startsWith(appUrl));
assert.ok(page, 'Open the real launcher URL in the test browser first');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
let id = 0;
const pending = new Map();
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  const request = pending.get(message.id);
  if (request) { pending.delete(message.id); clearTimeout(request.timer); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const requestId = ++id;
  const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('Browser command timed out: ' + method)); }, 10000);
  pending.set(requestId, { resolve, reject, timer });
  ws.send(JSON.stringify({ id: requestId, method, params }));
});
const evaluate = async expression => {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  assert.ok(!response.exceptionDetails, 'Browser evaluation failed');
  return response.result.value;
};
try {
  assert.match(await evaluate(`document.querySelector('#service-status').textContent`), /workspace ready/i);
  await evaluate(`document.querySelector('[data-nav="dicom"]').click()`);
  const { root } = await send('DOM.getDocument');
  const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '#dicom-file' });
  for (const [name, size, modality, count] of [['CT_small.dcm', 39206, 'CT', 20], ['MR_small.dcm', 9830, 'MR', 19]]) {
    // Assigns the real browser File and fires the real input handler; OS dialog is manual.
    await send('DOM.setFileInputFiles', { nodeId, files: [fileURLToPath(new URL('../fixtures/pydicom/' + name, import.meta.url))] });
    const result = await evaluate(`(async () => {
      const file = document.querySelector('#dicom-file').files[0];
      const bytes = await file.arrayBuffer();
      const deadline = Date.now() + 5000;
      while (document.querySelector('#dicom-status').textContent.includes('Reading local') && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25));
      const rows = [...document.querySelectorAll('#dicom-tags tr')].slice(1);
      const value = label => rows.find(row => row.cells[0].textContent === label)?.cells[1].textContent;
      return { name: file.name, size: file.size, bufferBytes: bytes.byteLength, marker: String.fromCharCode(...new Uint8Array(bytes, 128, 4)),
        count: rows.length, modality: value('Modality'), uid: document.querySelector('#dicom-uid').textContent,
        identifiersPresent: ['Study Instance UID', 'Series Instance UID', 'SOP Instance UID'].every(label => Boolean(value(label))),
        visible: !document.querySelector('[data-workspace="dicom"]').hidden, completed: document.querySelector('#dicom-status').textContent.startsWith('Read locally') };
    })()`);
    assert.equal(result.name, name); assert.equal(result.size, size); assert.equal(result.bufferBytes, size);
    assert.equal(result.marker, 'DICM'); assert.equal(result.count, count); assert.equal(result.modality, modality);
    assert.match(result.uid, new RegExp(modality + ' Image Storage')); assert.match(result.uid, /Explicit VR Little Endian/);
    assert.ok(result.identifiersPresent && result.visible && result.completed);
    console.log(`${name}: ${size} bytes, DICM, ${count} rendered metadata rows, ${modality} SOP class, Explicit VR Little Endian, all instance identifiers present — PASS`);
  }
  await evaluate(`document.querySelector('#dicom-file').scrollIntoView({block:'center'})`);
} finally { ws.close(); }
