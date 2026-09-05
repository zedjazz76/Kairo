import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

export async function startService() {
  const dataRoot = mkdtempSync(path.join(tmpdir(), 'hl7-integration-'));
  const token = randomBytes(32).toString('hex');
  const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'hl7-toolkit/service/Start-HL7Toolkit.ps1', '-Port', '0', '-Token', token, '-DataRoot', dataRoot, '-NoBrowser'], { windowsHide: true });
  let diagnostics = '';
  child.stderr.on('data', (chunk) => { diagnostics += chunk; });
  const stop = async () => {
    if (child.exitCode === null) { const ended = new Promise((resolve) => child.once('exit', resolve)); child.kill(); await ended; }
    if (!path.resolve(dataRoot).startsWith(path.resolve(tmpdir()) + path.sep)) throw new Error('Unsafe test cleanup');
    rmSync(dataRoot, { recursive: true, force: true });
  };
  try {
    const baseUrl = await new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => reject(new Error('Local service did not start: ' + diagnostics)), 12000);
      child.on('error', (error) => { clearTimeout(timeout); reject(error); });
      child.on('exit', () => { clearTimeout(timeout); reject(new Error('Local service exited: ' + diagnostics)); });
      child.stdout.on('data', (chunk) => { output += chunk; const match = /Address: (http:\/\/127\.0\.0\.1:\d+)\//.exec(output); if (match) { clearTimeout(timeout); resolve(match[1]); } });
    });
    const request = async (route, { method = 'GET', body, headers = {} } = {}) => {
      const response = await fetch(baseUrl + route, { method, headers: { 'X-HL7-Token': token, 'Content-Type': 'application/json', ...headers }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) });
      return { status: response.status, data: await response.json(), headers: response.headers };
    };
    return { baseUrl, dataRoot, token, request, stop, diagnostics: () => diagnostics };
  } catch (error) { await stop(); throw error; }
}
