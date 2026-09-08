import assert from 'node:assert/strict';
import test from 'node:test';
import { WORKSPACE_TOOLS, createWorkspaceNavigation } from '../../hl7-toolkit/app/scripts/workspace-navigation.mjs';

function harness() {
  const nodes = new Map(); let activeElement = null;
  const makeNode = (tag = 'div') => ({ tagName: tag.toUpperCase(), hidden: false, disabled: false, textContent: '', children: [], dataset: {}, listeners: {}, attributes: {},
    addEventListener(type, listener) { this.listeners[type] = listener; }, append(...items) { this.children.push(...items); }, replaceChildren(...items) { this.children = items; },
    setAttribute(name, value) { this.attributes[name] = value; }, removeAttribute(name) { delete this.attributes[name]; }, focus() { activeElement = this; },
    showModal() { this.open = true; }, close() { this.open = false; this.listeners.close?.(); } });
  const add = (selector, tag) => { const node = makeNode(tag); nodes.set(selector, node); return node; };
  for (const workspace of ['home', 'inspect', 'compare', 'validate', 'diagnostics', 'case', 'send', 'history']) add(`[data-workspace="${workspace}"]`);
  for (const workspace of ['inspect', 'diagnostics']) { add(`#${workspace}-landing`); add(`#${workspace}-tool-view`); add(`#${workspace}-tool-heading`, 'h1'); add(`#${workspace}-breadcrumb`); add(`#${workspace}-back`, 'button'); add(`#${workspace}-tool-host`); }
  for (const tools of Object.values(WORKSPACE_TOOLS)) for (const tool of tools) add(`[data-tool-panel="${tool.id}"]`);
  const dialog = add('#tool-guide-dialog', 'dialog'); add('#tool-guide-title', 'h2'); add('#tool-guide-purpose'); add('#tool-guide-example'); add('#tool-guide-steps', 'ol'); add('#tool-guide-results'); add('#tool-guide-tip'); add('#tool-guide-close', 'button');
  const root = { createElement: makeNode, querySelector: selector => nodes.get(selector) ?? null, querySelectorAll(selector) { if (selector === '[data-workspace]') return [...nodes.entries()].filter(([key]) => key.startsWith('[data-workspace=')).map(([, value]) => value); if (selector === '[data-tool-panel]') return [...nodes.entries()].filter(([key]) => key.startsWith('[data-tool-panel=')).map(([, value]) => value); return []; }, get activeElement() { return activeElement; } };
  return { root, nodes, dialog, get activeElement() { return activeElement; } };
}

test('registry defines exact selector inventories and complete concise guides', () => {
  assert.deepEqual(WORKSPACE_TOOLS.inspect.map(tool => tool.id), ['hl7-inspector', 'dicom-inspector']);
  assert.deepEqual(WORKSPACE_TOOLS.diagnostics.map(tool => tool.id), ['profiles-baselines', 'dicom-connectivity', 'mwl', 'orm-mwl-comparison', 'dicom-query-retrieve', 'http-tls', 'hl7-mllp']);
  for (const tool of [...WORKSPACE_TOOLS.inspect, ...WORKSPACE_TOOLS.diagnostics]) {
    assert.ok(tool.name && tool.description && tool.example);
    assert.ok(tool.guide.purpose && tool.guide.results && tool.guide.tip);
    assert.ok(tool.guide.steps.length >= 3 && tool.guide.steps.length <= 5);
  }
});

test('selector navigation opens one tool, renders breadcrumb, and returns without clearing tool state', () => {
  const h = harness(); const navigation = createWorkspaceNavigation(h.root);
  const input = h.root.createElement('input'); input.value = 'preserved'; h.nodes.get('[data-tool-panel="mwl"]').append(input);
  navigation.showWorkspace('diagnostics');
  assert.equal(navigation.getState().mode, 'WORKSPACE_LANDING');
  navigation.openTool('diagnostics', 'mwl');
  assert.deepEqual(navigation.getState(), { mode: 'TOOL_OPEN', workspaceId: 'diagnostics', toolId: 'mwl' });
  assert.equal(h.nodes.get('#diagnostics-breadcrumb').textContent, 'Diagnostics > Modality Worklist');
  assert.equal(h.nodes.get('[data-tool-panel="mwl"]').hidden, false);
  assert.equal(h.nodes.get('[data-tool-panel="http-tls"]').hidden, true);
  navigation.backToWorkspace('diagnostics');
  navigation.openTool('diagnostics', 'mwl');
  assert.equal(input.value, 'preserved');
});

test('guide is text-safe, performs no tool action, closes, and restores focus', () => {
  const h = harness(); let clicks = 0; const invoker = h.root.createElement('button'); invoker.listeners.click = () => { clicks += 1; };
  const navigation = createWorkspaceNavigation(h.root);
  navigation.openGuide('diagnostics', 'dicom-connectivity', invoker);
  assert.equal(h.dialog.open, true); assert.equal(clicks, 0);
  assert.equal(h.nodes.get('#tool-guide-title').textContent, 'DICOM Connectivity');
  assert.equal(h.nodes.get('#tool-guide-steps').children.length, 4);
  navigation.closeGuide();
  assert.equal(h.dialog.open, false); assert.equal(h.activeElement, invoker); assert.equal(clicks, 0);
});

test('unknown tool fails closed to its selector landing', () => {
  const h = harness(); const navigation = createWorkspaceNavigation(h.root);
  assert.equal(navigation.openTool('diagnostics', 'unknown'), false);
  assert.deepEqual(navigation.getState(), { mode: 'WORKSPACE_LANDING', workspaceId: 'diagnostics', toolId: null });
});
