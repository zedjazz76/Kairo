import assert from 'node:assert/strict';
import test from 'node:test';
import { manualStudyQueryConfiguration } from './helpers/study-query-manual-scp.mjs';

test('manual Study Root SCP scenarios are deterministic synthetic and bounded', () => {
  const zero=manualStudyQueryConfiguration('zero'),one=manualStudyQueryConfiguration('one'),multiple=manualStudyQueryConfiguration('multiple'),cap=manualStudyQueryConfiguration('cap');
  assert.deepEqual(zero.scenario.responses,[{status:0x0000}]);
  assert.equal(one.accessionNumber,'KAIROQR001'); assert.equal(one.scenario.responses[0].item.patientName,'TEST^STUDY'); assert.equal(one.scenario.responses[0].item.studyInstanceUid,'1.2.840.999.7.3.1');
  assert.equal(multiple.scenario.responses.filter(response=>response.item).length,3);
  assert.equal(cap.scenario.responses.filter(response=>response.item).length,101); assert.equal(cap.scenario.cancelResponseStatus,0xfe00);
  for(const configuration of [zero,one,multiple,cap]) { assert.equal(configuration.host,'127.0.0.1'); assert.equal(configuration.calledAe,'TEST_QR'); assert.equal(configuration.callingAe,'KAIRO'); }
});
