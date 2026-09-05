# Stage Two Search and Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add responsive metadata and HL7-path filtering to the loaded in-memory message catalog.

**Architecture:** A pure search module validates and evaluates filters. Metadata filters run immediately in the workbench; deep HL7-path filters run in the existing worker with progress and cancellation, returning message IDs only.

**Tech Stack:** Vanilla ECMAScript modules, Web Workers, HTML5, CSS, Node.js built-in test runner.

**Spec:** `docs/specs/2026-09-05-stage-two-search-filter-design.md`

## Global Constraints

- Raw HL7 and filter values stay in browser and worker memory.
- No query values enter history, logs, URLs, filenames, or service requests.
- Filtering never mutates messages or changes selected-message send behavior.
- The existing 100 MiB input limit and progressive intake remain supported.
- Deep work must yield, report safe progress counts, and honor cancellation.
- No new runtime or package dependency.

---

### Task 1: Pure filter engine — completed September 5, 2026

**Files:**
- Create: `hl7-toolkit/app/scripts/search-filter.mjs`
- Create: `tests/hl7-toolkit/search-filter.test.mjs`

**Interfaces:**
- Produces: `validateFilter(filter) -> normalizedFilter`
- Produces: `isDeepFilter(filter) -> boolean`
- Produces: `filterMessages(messages, filter, options) -> Promise<{ ids, matched, total }>`

- [x] **Step 1: Write failing tests**

```javascript
test('combines metadata and path conditions without mutating messages', async () => {
  const messages = sampleMessages();
  const result = await filterMessages(messages, { conditions: [
    { id: 'a', target: 'metadata', field: 'family', operator: 'equals', value: 'ORU' },
    { id: 'b', target: 'path', field: 'OBX-5', operator: 'contains', value: 'critical' },
  ] });
  assert.deepEqual(result.ids, ['two']);
  assert.equal(messages[1].text, originalText);
});

test('rejects an invalid regular expression without echoing its value', () => {
  assert.throws(() => validateFilter({ conditions: [
    { id: 'a', target: 'path', field: 'OBX-5', operator: 'regex', value: '(secret' },
  ] }), (error) => error.code === 'FILTER_REGEX_INVALID' && !error.message.includes('secret'));
});
```

- [x] **Step 2: Verify the tests fail**

Run: `node --test tests/hl7-toolkit/search-filter.test.mjs`
Expected: FAIL because `search-filter.mjs` does not exist.

- [x] **Step 3: Implement validation and evaluation**

```javascript
export function validateFilter(filter) {
  const conditions = (filter?.conditions || []).map(normalizeCondition);
  return { conditions };
}

export function isDeepFilter(filter) {
  return filter.conditions.some(({ target }) => target === 'path');
}

export async function filterMessages(messages, filter, {
  signal, onProgress = () => {}, chunkSize = 250,
} = {}) {
  const normalized = validateFilter(filter);
  const ids = [];
  for (let offset = 0; offset < messages.length; offset += chunkSize) {
    if (signal?.aborted) throw new DOMException('Filter canceled', 'AbortError');
    for (const message of messages.slice(offset, offset + chunkSize)) {
      if (matchesAll(message, normalized.conditions)) ids.push(message.id);
    }
    onProgress({ processed: Math.min(offset + chunkSize, messages.length), total: messages.length, matched: ids.length });
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return { ids, matched: ids.length, total: messages.length };
}
```

- [x] **Step 4: Run focused tests**

Run: `node --test tests/hl7-toolkit/search-filter.test.mjs`
Expected: PASS for operators, paths, repetitions, AND logic, validation, and nonmutation.

- [x] **Step 5: Commit**

```text
git add hl7-toolkit/app/scripts/search-filter.mjs tests/hl7-toolkit/search-filter.test.mjs
git commit -m "feat: add HL7 catalog filter engine"
```

### Task 2: Worker filtering — completed September 5, 2026

**Files:**
- Modify: `hl7-toolkit/app/workers/intake-worker.mjs`
- Modify: `hl7-toolkit/app/scripts/worker-requests.mjs`
- Create: `tests/hl7-toolkit/search-filter-worker.test.mjs`

**Interfaces:**
- Consumes: `filterMessages(messages, filter, options)`
- Produces worker events: `filter-progress`, `filter-complete`, and `filter-error`
- Produces: `workerRequests.filter(messages, filter, { signal, onProgress })`

- [x] **Step 1: Write failing worker tests**

```javascript
test('deep filtering reports safe progress and matching IDs', async () => {
  const events = [];
  await processFilter({ id: 'f1', messages: sampleMessages(), filter: deepFilter() }, {
    emit: (event) => events.push(event),
  });
  assert.ok(events.some(({ type }) => type === 'filter-progress'));
  assert.deepEqual(events.at(-1).ids, ['two']);
  assert.equal(JSON.stringify(events).includes('critical result'), false);
});
```

- [x] **Step 2: Verify the tests fail**

Run: `node --test tests/hl7-toolkit/search-filter-worker.test.mjs`
Expected: FAIL because `processFilter` is not exported.

- [x] **Step 3: Add filter request handling**

```javascript
export async function processFilter(request, { emit, signal } = {}) {
  const result = await filterMessages(request.messages, request.filter, {
    signal,
    onProgress: ({ processed, total, matched }) =>
      emit({ type: 'filter-progress', id: request.id, processed, total, matched }),
  });
  emit({ type: 'filter-complete', id: request.id, ...result });
}
```

The worker must cancel the prior filter controller when a newer filter request arrives and must omit raw values from errors.

- [x] **Step 4: Run focused worker tests**

Run: `node --test tests/hl7-toolkit/search-filter-worker.test.mjs tests/hl7-toolkit/worker-requests.test.mjs`
Expected: PASS for progress, cancellation, stale result isolation, and safe events.

- [x] **Step 5: Commit**

```text
git add hl7-toolkit/app/workers/intake-worker.mjs hl7-toolkit/app/scripts/worker-requests.mjs tests/hl7-toolkit/search-filter-worker.test.mjs
git commit -m "feat: filter HL7 paths in the intake worker"
```

### Task 3: Advanced filter interface — completed September 5, 2026

**Files:**
- Modify: `hl7-toolkit/app/index.html`
- Modify: `hl7-toolkit/app/styles/app.css`
- Modify: `hl7-toolkit/app/scripts/workbench.mjs`
- Modify: `tests/hl7-toolkit/ui-contract.test.mjs`

**Interfaces:**
- Consumes: `validateFilter`, `isDeepFilter`, `filterMessages`, and worker filter requests
- Updates: `state.catalogFilter = { conditions, matchingIds, running, error }`

- [x] **Step 1: Add failing UI contract tests**

```javascript
for (const label of ['Advanced filters', 'Add condition', 'Apply filters', 'Clear filters']) {
  assert.ok(html.includes(label), `Missing filter control: ${label}`);
}
assert.match(html, /id="filter-status"[^>]*aria-live="polite"/);
assert.match(html, /id="filter-error"[^>]*aria-live="assertive"/);
```

- [x] **Step 2: Verify the UI test fails**

Run: `node --test tests/hl7-toolkit/ui-contract.test.mjs`
Expected: FAIL for missing Stage Two controls.

- [x] **Step 3: Add accessible controls and rendering**

```javascript
async function applyAdvancedFilter() {
  const filter = readFilterControls();
  const normalized = validateFilter(filter);
  if (!isDeepFilter(normalized)) {
    const result = await filterMessages(state.messages, normalized, { chunkSize: state.messages.length || 1 });
    setCatalogMatches(result.ids);
    return;
  }
  await runWorkerFilter(normalized);
}
```

Render repeatable conditions, keep filter values out of URLs and history, disable Apply during deep evaluation, preserve the last valid result on error, and make Clear restore all message IDs.

- [x] **Step 4: Run UI and filter tests**

Run: `node --test tests/hl7-toolkit/search-filter.test.mjs tests/hl7-toolkit/search-filter-worker.test.mjs tests/hl7-toolkit/ui-contract.test.mjs`
Expected: PASS.

- [x] **Step 5: Commit**

```text
git add hl7-toolkit/app/index.html hl7-toolkit/app/styles/app.css hl7-toolkit/app/scripts/workbench.mjs tests/hl7-toolkit/ui-contract.test.mjs
git commit -m "feat: add advanced HL7 catalog filters"
```

### Task 4: Full regression and documentation — completed September 5, 2026

**Files:**
- Modify: `hl7-toolkit/README.md`
- Modify: `hl7-toolkit/VERIFICATION.md`

**Interfaces:**
- Documents the Stage Two search workflow, privacy boundary, and current limitations.

- [x] **Step 1: Document filtering**

Add instructions covering instant metadata filtering, optional deep path filtering, AND logic, clearing filters, invalid regular expressions, and the rule that search terms are not saved.

- [x] **Step 2: Run the complete automated suite**

Run: `node --test --test-isolation=none tests/hl7-toolkit/*.test.mjs`
Expected: all tests pass with zero failures.

- [x] **Step 3: Run the PowerShell service probe**

Run: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/hl7-toolkit/helpers/service-probe.ps1`
Expected: `service probe passed`.

- [x] **Step 4: Inspect tracked data and diff**

Run: `git status --short && git diff --check && git ls-files hl7-toolkit/data`
Expected: only `hl7-toolkit/data/README.md` is tracked below the data path, and no runtime content appears.

- [x] **Step 5: Commit**

```text
git add hl7-toolkit/README.md hl7-toolkit/VERIFICATION.md docs/plans/2026-09-05-stage-two-search-filter.md
git commit -m "docs: describe Stage Two HL7 filtering"
```
