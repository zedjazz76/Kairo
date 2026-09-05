import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('launcher and server require no elevation and bind loopback', () => {
  const launcher = readFileSync('hl7-toolkit/Open HL7 Toolkit.cmd', 'utf8');
  const start = readFileSync('hl7-toolkit/service/Start-HL7Toolkit.ps1', 'utf8');

  assert.match(launcher, /powershell(?:\.exe)?/i);
  assert.doesNotMatch(
    launcher + start,
    /runas|Start-Process.+-Verb\s+RunAs|netsh|New-Service|Set-ExecutionPolicy/i,
  );
  assert.match(start, /127\.0\.0\.1/);
  assert.match(start, /New-HL7SessionToken/);
});
