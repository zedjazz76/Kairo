// Actual-browser check for local PNG/JPEG sanitization. Synthetic pixels only.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const packageRoot = process.argv[2];
const debugUrl = process.argv[3] || 'http://127.0.0.1:9222';
assert.ok(packageRoot, 'Pass the extracted win3 package directory as argument 2');
const executable = join(packageRoot, 'Kairo.Helper.exe');
assert.ok(existsSync(executable), `Missing packaged runtime: ${executable}`);

const runtime = spawn(executable, [], { cwd: packageRoot, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: false });
let startupOutput = '';
const readStartupOutput = chunk => { startupOutput += chunk.toString(); };
runtime.stdout.on('data', readStartupOutput);
runtime.stderr.on('data', readStartupOutput);

const appUrl = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Packaged runtime did not report its authenticated URL: ${startupOutput}`)), 15_000);
  const check = () => {
    const match = startupOutput.match(/Kairo is running locally at (http:\/\/127\.0\.0\.1:\d+\/)/i);
    if (!match) return;
    clearTimeout(timer);
    resolve(match[1]);
  };
  runtime.stdout.on('data', check);
  runtime.stderr.on('data', check);
  runtime.once('error', error => { clearTimeout(timer); reject(error); });
  runtime.once('exit', (code, signal) => {
    clearTimeout(timer);
    reject(new Error(`Packaged runtime exited before startup (code=${code}, signal=${signal}): ${startupOutput}`));
  });
});

let page;
const pageDeadline = Date.now() + 15_000;
while (!page && Date.now() < pageDeadline) {
  try {
    const pages = await (await fetch(debugUrl + '/json/list')).json();
    page = pages.find(item => item.type === 'page' && item.webSocketDebuggerUrl);
  } catch { }
  if (!page) await new Promise(resolve => setTimeout(resolve, 100));
}
assert.ok(page, `No debuggable Chrome page was available at ${debugUrl}`);
const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
let sequence = 0; const pending = new Map(); let loadEvent;
const pageLoaded = new Promise(resolve => { loadEvent = resolve; });
ws.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  if (message.method === 'Page.loadEventFired') loadEvent();
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  clearTimeout(request.timer);
  message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result);
});
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); reject(new Error('Browser command timed out')); }, 15_000); pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); assert.ok(!response.exceptionDetails, response.exceptionDetails?.exception?.description || 'Browser evaluation failed'); return response.result.value; };
try {
  await send('Page.enable');
  await send('Page.navigate', { url: appUrl });
  await Promise.race([
    pageLoaded,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Chrome did not load the packaged Kairo URL')), 15_000)),
  ]);
  await evaluate(`(async()=>{const deadline=Date.now()+10000;while(document.readyState!=='complete'&&Date.now()<deadline)await new Promise(r=>setTimeout(r,25));return document.readyState;})()`);
  const ready = await evaluate(`(async()=>{const deadline=Date.now()+10000;while(!/workspace ready/i.test(document.querySelector('#service-status')?.textContent||'')&&Date.now()<deadline)await new Promise(r=>setTimeout(r,25));return document.querySelector('#service-status')?.textContent||'';})()`);
  assert.match(ready, /workspace ready/i);
  const encoderShape = await evaluate(`(async()=>{const c=document.createElement('canvas');c.width=8;c.height=6;const blob=await new Promise(r=>c.toBlob(r,'image/png'));const b=new Uint8Array(await blob.arrayBuffer());const chunks=[];let o=8;while(o+12<=b.length){const n=new DataView(b.buffer).getUint32(o);chunks.push(String.fromCharCode(...b.slice(o+4,o+8)));o+=12+n;}return chunks;})()`);
  assert.ok(encoderShape.includes('IHDR') && encoderShape.includes('IDAT') && encoderShape.includes('IEND'), `Unexpected Chrome PNG encoder shape: ${encoderShape.join(',')}`);
  process.stdout.write(`Chrome PNG encoder chunks: ${encoderShape.join(',')}\n`);
  const rasterProbe = await evaluate(`(async()=>{const c=document.createElement('canvas');c.width=8;c.height=6;const x=c.getContext('2d');x.fillStyle='#f00';x.fillRect(0,0,8,6);const blob=await new Promise(r=>c.toBlob(r,'image/png'));const bytes=new Uint8Array(await blob.arrayBuffer());const f=await import('/scripts/image-format.mjs');const r=await import('/scripts/image-raster.mjs');try{await r.sanitizeRaster({sourceBytes:bytes,inspection:f.inspectImageBytes(bytes),rectangles:[{x:0,y:0,width:4,height:3}],outputFormat:'png',adapter:r.createBrowserRasterAdapter(globalThis)});return 'PASS';}catch(e){return e.message;}})()`);
  assert.equal(rasterProbe, 'PASS', `Browser raster probe failed: ${rasterProbe}`);
  const ocrProbe = await evaluate(`(async()=>{const c=document.createElement('canvas');c.width=1400;c.height=500;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#000';x.font='bold 52px Arial';x.fillText('PATIENT: TEST PATIENT',30,80);x.fillText('MRN: TEST123456',30,170);x.fillText('ACCESSION: TESTACC001',30,260);x.fillText('DOB: 19800101',30,350);x.fillText('PHYSICIAN: TEST DOCTOR',30,440);const o=await import('/scripts/image-phi-assist.mjs');const a=o.createBrowserOcrAdapter();const result=await a.recognize(c);await a.dispose();const findings=o.normalizeOcrWords(result.words,{width:c.width,height:c.height});return {detected:findings.length,likely:findings.filter(f=>f.classification==='LIKELY_PHI').length,possible:findings.filter(f=>f.classification==='POSSIBLE_PHI').length,classified:findings.filter(f=>f.classification!=='NOT_CLASSIFIED').length};})()`);
  assert.ok(ocrProbe.detected >= 2, `OCR detected too few text regions: ${JSON.stringify(ocrProbe)}`);
  assert.ok(ocrProbe.likely >= 1, `OCR did not classify likely PHI: ${JSON.stringify(ocrProbe)}`);
  assert.ok(ocrProbe.classified < ocrProbe.detected, `OCR classified every region as PHI: ${JSON.stringify(ocrProbe)}`);
      process.stdout.write(`Local OCR assistance probe: ${ocrProbe.detected} regions, ${ocrProbe.likely} likely PHI, ${ocrProbe.possible} possible PHI\n`);
      await evaluate(`document.querySelector('#quick-open').click(); document.querySelector('#quick-image-open').click()`);
      const packagedPhiProbe = await evaluate(`(async()=>{const c=document.createElement('canvas');c.width=1400;c.height=500;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#000';x.font='bold 52px Arial';for(const [line,y] of [['PATIENT: TEST PATIENT',80],['MRN: TEST123456',170],['ACCESSION: TESTACC001',260],['DOB: 19800101',350],['PHYSICIAN: TEST DOCTOR',440]])x.fillText(line,30,y);const blob=await new Promise(r=>c.toBlob(r,'image/png'));const input=document.querySelector('#image-file');const transfer=new DataTransfer();transfer.items.add(new File([blob],'synthetic-phi.png',{type:'image/png'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));const deadline=Date.now()+20000;while(!document.querySelector('#image-ocr-status').dataset.pipelineStage?.includes('RENDERED')&&Date.now()<deadline)await new Promise(r=>setTimeout(r,25));const status=document.querySelector('#image-ocr-status');return {initialized:status.dataset.ocrInitialized,regions:Number(status.dataset.ocrRegionCount),candidates:Number(status.dataset.phiCandidateCount),rendered:Number(status.dataset.uiCandidatesRendered),stage:status.dataset.pipelineStage,error:status.dataset.errorCode||''};})()`);
      assert.equal(packagedPhiProbe.initialized, 'YES', JSON.stringify(packagedPhiProbe));
      assert.ok(packagedPhiProbe.regions > 0, JSON.stringify(packagedPhiProbe));
      assert.ok(packagedPhiProbe.candidates > 0, JSON.stringify(packagedPhiProbe));
      assert.ok(packagedPhiProbe.rendered > 0, JSON.stringify(packagedPhiProbe));
      process.stdout.write(`Packaged PNG PHI pipeline: OCR_INITIALIZED=${packagedPhiProbe.initialized} OCR_REGION_COUNT=${packagedPhiProbe.regions} PHI_CANDIDATE_COUNT=${packagedPhiProbe.candidates} UI_CANDIDATES_RENDERED=${packagedPhiProbe.rendered}\n`);
      for (const format of ['png', 'jpeg']) {
    const result = await evaluate(`(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 8; canvas.height = 6; const context = canvas.getContext('2d'); context.fillStyle = '#ff0000'; context.fillRect(0, 0, 8, 6);
      const sourceBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/${format}', .92)); let bytes = new Uint8Array(await sourceBlob.arrayBuffer());
      if ('${format}' === 'jpeg') { const payload = new TextEncoder().encode('Exif\\0\\0SYNTHETIC-CANARY'); const segment = new Uint8Array(4 + payload.length); segment.set([255,225,((payload.length+2)>>8)&255,(payload.length+2)&255]); segment.set(payload,4); bytes = new Uint8Array([...bytes.slice(0,2),...segment,...bytes.slice(2)]); }
      else {
        const payload = new TextEncoder().encode('Comment\\0SYNTHETIC-CANARY'); const type = new TextEncoder().encode('tEXt'); const crcTable = Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;}); let crc=0xffffffff; for(const value of [...type,...payload]) crc=crcTable[(crc^value)&255]^(crc>>>8); crc=(crc^0xffffffff)>>>0;
        const chunk = new Uint8Array(12+payload.length); new DataView(chunk.buffer).setUint32(0,payload.length); chunk.set(type,4); chunk.set(payload,8); new DataView(chunk.buffer).setUint32(8+payload.length,crc); bytes = new Uint8Array([...bytes.slice(0,-12),...chunk,...bytes.slice(-12)]);
      }
      const before = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
      const rasterModule=await import('/scripts/image-raster.mjs');const debugAdapter=rasterModule.createBrowserRasterAdapter(globalThis);const debugDecoded=await debugAdapter.decode(bytes,'${format}');const debugRendered=await debugAdapter.render(debugDecoded,[{x:0,y:0,width:4,height:3}],{format:'${format}',quality:.92,background:'#fff',fill:'#000'});debugAdapter.dispose(debugDecoded);let directShape=[];if('${format}'==='png'){let o=8;while(o+12<=debugRendered.bytes.length){const n=new DataView(debugRendered.bytes.buffer,debugRendered.bytes.byteOffset).getUint32(o);directShape.push(String.fromCharCode(...debugRendered.bytes.slice(o+4,o+8)));o+=12+n;}}else{for(let o=2;o+1<debugRendered.bytes.length;){if(debugRendered.bytes[o++]!==255)break;const marker=debugRendered.bytes[o++];directShape.push(marker.toString(16));if(marker===217)break;if(marker===216||(marker>=208&&marker<=215))continue;const n=(debugRendered.bytes[o]<<8)|debugRendered.bytes[o+1];o+=n;}}
      const input = document.querySelector('#image-file'); const transfer = new DataTransfer(); transfer.items.add(new File([bytes], 'synthetic.${format === 'jpeg' ? 'jpg' : 'png'}', {type:'image/${format}'})); input.files = transfer.files; const selectedFile=input.files[0]; input.dispatchEvent(new Event('change', {bubbles:true}));
      const wait = async test => { const deadline=Date.now()+10000; while(!test()&&Date.now()<deadline) await new Promise(r=>setTimeout(r,20)); if(!test()) throw new Error('UI_TIMEOUT'); };
      await wait(()=>document.querySelector('#image-source-status').textContent.startsWith('Loaded locally'));
      const set = (id,value) => document.querySelector(id).value=value; set('#image-redact-x',0);set('#image-redact-y',0);set('#image-redact-width',4);set('#image-redact-height',3);document.querySelector('#image-add-redaction').click(); set('#image-redact-x',6);set('#image-redact-y',4);set('#image-redact-width',2);set('#image-redact-height',2);document.querySelector('#image-add-redaction').click(); document.querySelector('#image-undo').click(); document.querySelector('#image-add-redaction').click();
      document.querySelector('#image-output-format').value='${format}'; document.querySelector('#image-output-format').dispatchEvent(new Event('change')); document.querySelector('#image-preview').click(); await wait(()=>!document.querySelector('#image-output-preview').hidden||!document.querySelector('#image-error').hidden);if(!document.querySelector('#image-error').hidden)return {diagnostic:{phase:'production-preview',code:document.querySelector('#image-error').dataset.code,error:document.querySelector('#image-error').textContent,metadata:document.querySelector('#image-metadata-status').textContent,directShape}};
      const preview=document.querySelector('#image-output-preview');const decodeDeadline=Date.now()+10000;while(!(preview.complete&&preview.naturalWidth>0)&&Date.now()<decodeDeadline)await new Promise(r=>setTimeout(r,20));if(!preview.naturalWidth)return {diagnostic:{complete:preview.complete,src:preview.getAttribute('src'),error:document.querySelector('#image-error').textContent,metadata:document.querySelector('#image-metadata-status').textContent,state:document.querySelector('#image-review-status').textContent}};const structure={format:'${format}',width:preview.naturalWidth,height:preview.naturalHeight};const reopened=document.createElement('canvas');reopened.width=8;reopened.height=6;const rc=reopened.getContext('2d');rc.drawImage(preview,0,0);const black=rc.getImageData(1,1,1,1).data;const outside=rc.getImageData(5,3,1,1).data;
      document.querySelector('#image-reviewed').click(); const complete=document.querySelector('#image-review-status').textContent; const metadata=document.querySelector('#image-metadata-status').textContent; const redactions=document.querySelector('#image-redaction-count').textContent; document.querySelector('#image-save').click();
      const afterBytes = new Uint8Array(await selectedFile.arrayBuffer()); const after=[...new Uint8Array(await crypto.subtle.digest('SHA-256',afterBytes))].map(v=>v.toString(16).padStart(2,'0')).join(''); document.querySelector('#image-reset').click();
      return {structure,black:[...black],outside:[...outside],complete,metadata,redactions,sourceUnchanged:before===after,resetCount:document.querySelector('#image-redaction-count').textContent};
    })()`);
    assert.equal(result.diagnostic, undefined, JSON.stringify(result.diagnostic)); assert.deepEqual(result.structure, { format, width: 8, height: 6 }); assert.ok(result.black.slice(0,3).every(value => value <= (format === 'jpeg' ? 24 : 0))); assert.ok(result.outside[0] > 180);
    assert.equal(result.complete, 'SANITIZATION REVIEW COMPLETE'); assert.equal(result.metadata, 'METADATA SANITIZED'); assert.equal(result.redactions, '2'); assert.equal(result.sourceUnchanged, true); assert.equal(result.resetCount, '0');
  }
  const dicom = await evaluate(`(async()=>{document.querySelector('#image-clear').click();const bytes=new Uint8Array(132);bytes.set(new TextEncoder().encode('DICM'),128);const t=new DataTransfer();t.items.add(new File([bytes],'synthetic.dcm',{type:'application/dicom'}));const input=document.querySelector('#image-file');input.files=t.files;input.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,50));return {error:document.querySelector('#image-error').textContent,save:document.querySelector('#image-save').disabled};})()`);
  assert.match(dicom.error, /DICOM image sanitization is not supported/); assert.equal(dicom.save, true);
  process.stdout.write('Actual browser PNG/JPEG flattening, metadata removal, integrity, review, reset, and DICOM rejection — PASS\n');
} finally { ws.close(); if (!runtime.killed) runtime.kill(); }
