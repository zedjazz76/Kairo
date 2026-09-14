const unavailable = (segment, version) => ({
  segment, name: '', purpose: 'Definition not available', examples: [], version,
  scopeLabel: 'General HL7 v2 segment purpose',
});

export function createSegmentHelpIndex(definitions = {}) {
  if (definitions.schema !== 'kairo.hl7-segment-purposes.v1' || !Array.isArray(definitions.segments)) throw new Error('SEGMENT_DEFINITIONS_INVALID');
  const entries = new Map();
  for (const item of definitions.segments) {
    if (!item || !/^[A-Z][A-Z0-9]{2}$/.test(item.id) || typeof item.name !== 'string' || typeof item.purpose !== 'string' || !Array.isArray(item.examples)) throw new Error('SEGMENT_DEFINITIONS_INVALID');
    entries.set(item.id, Object.freeze({ segment: item.id, name: item.name, purpose: item.purpose, examples: item.examples.map(example => Object.freeze({ code: example.code, label: example.label })) }));
  }
  return {
    get(segment, version = '') {
      const id = typeof segment === 'string' ? segment.toUpperCase() : '';
      const entry = entries.get(id);
      return entry ? { ...entry, examples: [...entry.examples], version, scopeLabel: 'General HL7 v2 segment purpose' } : unavailable(id, version);
    },
    get size() { return entries.size; },
  };
}

const textNode = (document, tag, text, className = '') => {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
};

export function renderSegmentPurpose(document, container, help) {
  const heading = textNode(document, 'h3', help.name ? `${help.segment} — ${help.name}` : help.segment);
  const label = textNode(document, 'strong', 'Standard purpose');
  const purpose = textNode(document, 'p', help.purpose);
  const scope = textNode(document, 'p', help.scopeLabel, 'small');
  const version = textNode(document, 'p', `HL7 version: ${help.version || 'Not declared'}`, 'small');
  const content = [heading, label, purpose, scope, version];
  if (help.examples.length) {
    content.push(textNode(document, 'strong', 'Common use examples (not exhaustive)'));
    const list = document.createElement('ul');
    for (const example of help.examples) list.append(textNode(document, 'li', `${example.code} — ${example.label}`));
    content.push(list);
  }
  container.replaceChildren(...content);
}
