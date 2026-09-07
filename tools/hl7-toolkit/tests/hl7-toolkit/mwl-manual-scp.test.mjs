import assert from 'node:assert/strict';
import test from 'node:test';
import { manualMwlConfiguration } from './helpers/mwl-manual-scp.mjs';

test('manual MWL SCP scenarios are deterministic, synthetic, and bounded', () => {
  const date = '20260907';
  const zero = manualMwlConfiguration('zero', date);
  const one = manualMwlConfiguration('one', date);
  const multiple = manualMwlConfiguration('multiple', date);
  assert.deepEqual(zero.scenario.responses, [{ status: 0x0000 }]);
  assert.equal(one.scenario.responses.length, 2);
  assert.equal(one.scenario.responses[0].item.patientName, 'TEST^MWL');
  assert.equal(one.scenario.responses[0].item.patientId, 'KAIRO-MWL-001');
  assert.equal(one.scenario.responses[0].item.accessionNumber, 'KAIROACC001');
  assert.equal(one.scenario.responses[0].item.scheduledProcedureStep.modality, 'MR');
  assert.equal(one.scenario.responses[0].item.scheduledProcedureStep.scheduledStationAe, 'KAIRO_MR');
  assert.equal(one.scenario.responses[0].item.scheduledProcedureStep.scheduledDate, date);
  assert.equal(multiple.scenario.responses.filter(response => response.item).length, 3);
  for (const configuration of [zero, one, multiple]) {
    assert.equal(configuration.host, '127.0.0.1');
    assert.equal(configuration.calledAe, 'TEST_MWL');
    assert.equal(configuration.callingAe, 'KAIRO');
    assert.equal(configuration.scheduledDate, '2026-09-07');
  }
});
