import assert from 'node:assert/strict';
import test from 'node:test';
import { parseHl7 } from '../../hl7-toolkit/app/scripts/hl7-parser.mjs';
import { inspectOrmMessage, projectOrmGroup } from '../../hl7-toolkit/app/scripts/orm-workflow-adapter.mjs';

const message = segments => parseHl7(['MSH|^~\\&|A|F|B|F|202609071000||ORM^O01|1|P|2.5.1', ...segments].join('\r'));

test('accepts ORM with ORC, OBR, or both and preserves MSH-9', () => {
  for (const segments of [['ORC|NW'], ['OBR|1|P1|F1|PROC^MRI^LOCAL'], ['ORC|NW', 'OBR|1|P1|F1|PROC^MRI^LOCAL']]) {
    const result = inspectOrmMessage(message(segments));
    assert.equal(result.eligibility, 'ELIGIBLE');
    assert.equal(result.msh9, 'ORM^O01');
  }
});

test('rejects non-ORM, orderless ORM, and malformed input', () => {
  assert.equal(inspectOrmMessage(parseHl7('MSH|^~\\&|A|F|B|F|202609071000||ADT^A01|1|P|2.5.1\rOBR|1')).eligibility, 'ORM_REQUIRED');
  assert.equal(inspectOrmMessage(message(['PID|1||ID'])).eligibility, 'ORM_REQUIRED');
  assert.equal(inspectOrmMessage(parseHl7('PID|1||ID')).eligibility, 'ORM_REQUIRED');
});

test('derives structural groups and never merges their values', () => {
  const parsed = message(['PID|1||ID^^^AUTH^MR', 'ORC|NW|GROUP-ONE|FILL-ONE', 'OBR|1|GROUP-ONE|FILL-ONE|P1^ONE^LOCAL', 'ORC|NW|GROUP-TWO|FILL-TWO', 'OBR|1|GROUP-TWO|FILL-TWO|P2^TWO^LOCAL']);
  const inspection = inspectOrmMessage(parsed);
  assert.equal(inspection.groups.length, 2);
  assert.equal(inspection.selectionState, 'ORDER_GROUP_SELECTION_REQUIRED');
  const group = projectOrmGroup(inspection, inspection.groups[1].id);
  assert.deepEqual(group.values.filter(value => value.role === 'PLACER').map(value => value.path), ['ORC[2]-2', 'OBR[2]-2']);
  assert.doesNotMatch(JSON.stringify(group), /GROUP-ONE/);
  assert.ok(group.accessionChoices.some(choice => choice.path === 'OBR[2]-3'));
});

test('supports ORC-only and OBR-only groups with exact occurrence provenance', () => {
  const inspection = inspectOrmMessage(message(['ORC|NW|P1', 'ORC|CA|P2', 'OBR|1|P3|F3|PROC^THREE^LOCAL']));
  assert.equal(inspection.groups.length, 2);
  assert.deepEqual(inspection.groups.map(group => group.segmentOccurrences), [['ORC[1]'], ['ORC[2]', 'OBR[1]']]);
});

test('blocks structurally invalid parsed occurrence metadata as ambiguous', () => {
  const parsed = message(['ORC|NW|P1', 'OBR|1|P1']);
  parsed.segments.find(segment => segment.name === 'OBR').occurrence = 0;
  const inspection = inspectOrmMessage(parsed);
  assert.equal(inspection.ambiguity, 'ORDER_GROUP_AMBIGUOUS');
});

test('projects approved group-local modality location and schedule provenance', () => {
  const orc = Array(14).fill(''); orc[0] = 'ORC'; orc[1] = 'NW'; orc[13] = 'WARD-A';
  const obr = Array(37).fill(''); obr[0] = 'OBR'; obr[1] = '1'; obr[4] = 'PROC^MRI^LOCAL'; obr[24] = 'MR'; obr[36] = '202609071030';
  const parsed = message([orc.join('|'), obr.join('|')]);
  const inspection = inspectOrmMessage(parsed);
  const group = projectOrmGroup(inspection, inspection.groups[0].id);
  assert.deepEqual(group.values.filter(value => ['MODALITY', 'LOCATION', 'SCHEDULED_AT'].includes(value.role)).map(value => value.path), ['ORC[1]-13', 'OBR[1]-24', 'OBR[1]-36']);
});

test('keeps OBR-4 coded procedure and description as separate evidence', () => {
  const inspection = inspectOrmMessage(message(['OBR|1|P1|F1|12345^MRI Brain^LOCAL']));
  const group = projectOrmGroup(inspection, inspection.groups[0].id);
  assert.deepEqual(group.values.filter(value => value.concept === 'PROCEDURE').map(value => [value.role, value.path, value.value]), [
    ['PROCEDURE_CODE', 'OBR[1]-4', '12345^MRI Brain^LOCAL'],
    ['PROCEDURE_DESCRIPTION', 'OBR[1]-4.2', 'MRI Brain']
  ]);
});
