// Foreground Windows verification: real launcher, real Chrome UI, local controlled peers.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startService } from './service-harness.mjs';
import { startDicomPeer } from './dicom-peer.mjs';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const tokenCheck = spawnSync('whoami.exe', ['/groups', '/fo', 'csv', '/nh'], { encoding: 'utf8' });
assert.equal(tokenCheck.status, 0, 'Cannot inspect the Windows process token');
assert.ok(tokenCheck.stdout.includes('S-1-16-8192') && !/S-1-16-(12288|16384)/.test(tokenCheck.stdout), 'Verification requires a normal medium-integrity Windows token');
console.log('Windows token: medium integrity, not elevated.');
const service = await startService();
const profile = mkdtempSync(path.join(tmpdir(), 'kairo-stage5-chrome-'));
let browser, ws, peer;
const pending = new Map(); let id = 0;
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const requestId = ++id;
  const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('Browser command timeout: ' + method)); }, 15000);
  pending.set(requestId, { resolve, reject, timer });
  ws.send(JSON.stringify({ id: requestId, method, params }));
});
const evaluate = async expression => {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  assert.ok(!response.exceptionDetails, 'Browser evaluation failed'); return response.result.value;
};
try {
  browser = spawn(path.join(process.env.ProgramFiles, 'Google/Chrome/Application/chrome.exe'), ['--remote-debugging-port=0', '--user-data-dir=' + profile, '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  let port;
  for (let i = 0; i < 100; i++) { try { port = Number(readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]); break; } catch { await pause(100); } }
  assert.ok(port, 'Chrome debug port unavailable');
  const page = await (await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })).json();
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  ws.addEventListener('message', event => { const m = JSON.parse(event.data), p = pending.get(m.id); if (p) { clearTimeout(p.timer); pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); } });
  await send('Page.enable');
  const loaded = new Promise(resolve => {
    const onMessage = event => { if (JSON.parse(event.data).method === 'Page.loadEventFired') { ws.removeEventListener('message', onMessage); resolve(); } };
    ws.addEventListener('message', onMessage);
  });
  await send('Page.navigate', { url: service.baseUrl + '/?token=' + service.token });
  await Promise.race([loaded, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('Page load timed out')), 10000); timer.unref(); })]);
  const ready = await evaluate(`(async () => { const deadline = Date.now() + 10000; while (Date.now() < deadline) { if (document.querySelector('#service-status')?.textContent.includes('workspace ready')) return true; await new Promise(resolve => setTimeout(resolve, 50)); } return false; })()`);
  assert.ok(ready, 'Actual launcher workspace did not become ready');
  await evaluate(`document.querySelector('[data-nav="diagnostics"]').click()`);
  assert.equal(await evaluate(`document.querySelector('[data-workspace="diagnostics"]').hidden`), false);
  for (const [mode, action, classification, evidence] of [
    ['success', 'tcp', 'TCP_CONNECTED', 'NOT_RUN'],
    ['success', 'echo', 'C_ECHO_SUCCESS', 'C_ECHO_SUCCESS'],
    ['reject', 'echo', 'ASSOCIATION_REJECTED', 'NOT_RUN'],
    ['echo-failed', 'echo', 'C_ECHO_FAILED', 'C_ECHO_FAILED'],
    ['echo-timeout', 'echo', 'TIMEOUT', 'TIMEOUT'],
  ]) {
    peer = await startDicomPeer(mode);
    await evaluate(`(() => { for (const [key, value] of Object.entries(${JSON.stringify({ host: '127.0.0.1', port: String(peer.port), timeout: '500', calling: 'KAIRO', called: 'TEST_SCP' })})) document.querySelector('#diagnostic-' + key).value = value; document.querySelector('#diagnostic-${action}').click(); })()`);
    const result = await evaluate(`(async () => { const deadline = Date.now() + 10000; while (document.querySelector('#diagnostic-echo').disabled && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 25)); return { summary: document.querySelector('#diagnostic-result').textContent, tcp: document.querySelector('#diagnostic-layer-tcp').textContent, association: document.querySelector('#diagnostic-layer-association').textContent, echo: document.querySelector('#diagnostic-layer-echo').textContent }; })()`);
    assert.ok(result.summary.startsWith(classification), JSON.stringify(result));
    assert.match(result.tcp, /SUCCESS.*TCP_CONNECTED/);
    assert.ok(result.echo.includes(evidence));
    if (mode === 'reject') assert.match(result.association, /Called AE title not recognized/);
    if (action === 'tcp') assert.equal(peer.observations.echoes, 0);
    assert.deepEqual(peer.observations.errors, []);
    await evaluate(`document.querySelector('#diagnostic-result').scrollIntoView({block:'center'})`);
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path.join(tmpdir(), `kairo-stage5-${action}-${mode}.png`), Buffer.from(screenshot.data, 'base64'));
    console.log(`Real UI ${action}/${mode}: ${classification}, TCP preserved, C-ECHO ${evidence} — PASS`);
    await peer.close(); peer = null;
  }
  // Existing workspaces remain reachable in the same real launcher.
  for (const name of ['dicom', 'inspect', 'send']) {
    await evaluate(`document.querySelector('[data-nav="${name}"]').click()`);
    assert.equal(await evaluate(`document.querySelector('[data-workspace="${name}"]').hidden`), false);
  }
  console.log('Real launcher compilation/startup and existing workspace navigation — PASS');
} finally {
  if (peer) await peer.close();
  if (ws) { try { await send('Browser.close'); } catch {} ws.close(); }
  if (browser && browser.exitCode === null) await new Promise(resolve => { const timer = setTimeout(() => { browser.kill(); resolve(); }, 3000); browser.once('exit', () => { clearTimeout(timer); resolve(); }); });
  for (const request of pending.values()) clearTimeout(request.timer);
  await service.stop();
  try { rmSync(profile, { recursive: true, force: true }); } catch { /* Windows may briefly retain locks in this temporary test profile. */ }
}
