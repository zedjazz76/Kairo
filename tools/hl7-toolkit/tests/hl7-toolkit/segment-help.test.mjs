import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createSegmentHelpIndex, renderSegmentPurpose } from '../../hl7-toolkit/app/scripts/segment-help.mjs';
import { fieldDefinitionText } from '../../hl7-toolkit/app/scripts/workbench.mjs';

const definitions = JSON.parse(readFileSync('hl7-toolkit/app/definitions/hl7-segments.v1.json', 'utf8'));
const index = createSegmentHelpIndex(definitions);

const expectedNames = {
  MSH: 'Message Header', PID: 'Patient Identification', PV1: 'Patient Visit', ORC: 'Common Order',
  OBR: 'Observation Request', OBX: 'Observation/Result', MSA: 'Message Acknowledgment', ERR: 'Error',
};

for (const [segment, name] of Object.entries(expectedNames)) {
  test(`${segment} exposes its standards-based segment purpose`, () => {
    const help = index.get(segment, '2.5.1');
    assert.equal(help.segment, segment);
    assert.equal(help.name, name);
    assert.match(help.purpose, /\S/);
    assert.equal(help.version, '2.5.1');
    assert.equal(help.scopeLabel, 'General HL7 v2 segment purpose');
  });
}

test('unknown segments return the exact unavailable definition without invented meaning', () => {
  assert.deepEqual(index.get('ZXY', '2.5.1'), {
    segment: 'ZXY', name: '', purpose: 'Definition not available', examples: [], version: '2.5.1', scopeLabel: 'General HL7 v2 segment purpose',
  });
});

test('the approved initial segment set is present', () => {
  const required = ['MSH','MSA','ERR','PID','PD1','PV1','PV2','ORC','OBR','OBX','NTE','DG1','AL1','IN1','IN2','IN3','GT1','NK1','SCH','RGS','AIG','AIL','AIP','FT1','PR1'];
  for (const segment of required) assert.notEqual(index.get(segment, '2.5.1').purpose, 'Definition not available', segment);
});

test('existing field definitions remain a separate lookup', () => {
  const basicFields = { fields: { 'ORC-1': { label: 'Order control', datatype: 'ID' } } };
  assert.equal(fieldDefinitionText(basicFields, 'ORC[2]-1'), 'Order control · ID');
  assert.equal(fieldDefinitionText(basicFields, 'ZXY-1'), 'No Phase 1 label for this path — not evaluated.');
});

test('segment purpose rendering uses text nodes and keeps version and examples explicitly labeled', () => {
  const created = [];
  const document = { createElement(tag) { const node = { tag, textContent: '', className: '', children: [], append(...items) { this.children.push(...items); } }; created.push(node); return node; } };
  const container = { children: [], replaceChildren(...items) { this.children = items; } };
  renderSegmentPurpose(document, container, {
    segment: 'ORC', name: '<img src=x onerror=alert(1)>', purpose: '<script>alert(1)</script>',
    examples: [{ code: 'NW', label: '<b>New order</b>' }], version: '2.5.1', scopeLabel: 'General HL7 v2 segment purpose',
  });
  assert.equal(container.children[0].textContent, 'ORC — <img src=x onerror=alert(1)>');
  assert.ok(created.every(node => !('innerHTML' in node)));
  assert.match(created.map(node => node.textContent).join(' '), /HL7 version: 2\.5\.1/);
  assert.match(created.map(node => node.textContent).join(' '), /Common use examples \(not exhaustive\)/);
});

test('the inspector keeps segment purpose and field definition as separate regions', () => {
  const html = readFileSync('hl7-toolkit/app/index.html', 'utf8');
  assert.match(html, /id="segment-purpose"/);
  assert.match(html, /id="field-definition"/);
  assert.ok(html.indexOf('id="segment-purpose"') < html.indexOf('id="field-definition"'));
});
