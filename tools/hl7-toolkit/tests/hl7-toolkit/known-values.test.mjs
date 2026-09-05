import assert from 'node:assert/strict';
import test from 'node:test';
import { createKnownValueIndex } from '../../hl7-toolkit/app/scripts/known-values.mjs';

test('known-value index replaces the longest case-insensitive whole value and reports safe match locations', () => {
  const index = createKnownValueIndex();
  index.set('Mary', 'NAME-0001'); index.set('Mary Ann', 'NAME-0002'); index.set('MRN-456', 'MRN-0001');
  assert.equal(index.replace('mary ann; MARY; MRN-456; rosemary'), 'NAME-0002; NAME-0001; MRN-0001; rosemary');
  const matches = index.matches('prefixMRN-456suffix', { boundaries: false });
  assert.equal(matches[0].index, 6); assert.equal(matches[0].length, 7);
  assert.doesNotMatch(JSON.stringify(matches), /MRN-456/);
  index.clear(); assert.equal(index.replace('Mary Ann'), 'Mary Ann');
});
