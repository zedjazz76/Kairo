const HINTS = {
  'MSH-9': 'Message type and trigger, for example ORM^O01 or ORU^R01.',
  'MSH-10': 'Control ID used to match an ACK. Keep it unique for the send.',
  'PID-3': 'Patient identifiers such as MRN. Sanitize before copy or ticket paste.',
  'PID-5': 'Patient name. Always tokenized by the sanitizer.',
  'PID-7': 'Date of birth. Shown as a relative day after sanitize.',
  'PID-18': 'Account number. Treat as an identifier.',
  'PV1-19': 'Visit or encounter identifier.',
  'ORC-1': 'Order control: NW new, XO change, CA cancel, SC status.',
  'ORC-2': 'Placer order number from the ordering system.',
  'ORC-3': 'Filler order number from the performing system.',
  'OBR-3': 'Filler / accession identifier used to find the study.',
  'OBR-4': 'Requested procedure code and text.',
  'OBR-16': 'Ordering provider. Kairo preserves provider names by policy.',
  'OBX-5': 'Result value. Type depends on OBX-2. Review narrative.',
  'MSA-1': 'AA accepted, AE application error, AR reject.',
  'NTE-3': 'Free text. Review every line for leftover identifiers.',
};

function parsePath(value) {
  const match = /^([A-Z][A-Z0-9]{2})-(\d+)$/.exec(String(value || '').trim().toUpperCase());
  if (!match) return null;
  return { segment: match[1], field: Number(match[2]), path: `${match[1]}-${match[2]}` };
}

export function createFieldCoach({ fields = {}, segments } = {}) {
  const catalog = fields.fields || fields;
  return {
    explain(path) {
      const address = parsePath(path);
      if (!address) return { path: String(path || ''), found: false, title: 'Unknown field', detail: 'Type a path like OBR-16.' };
      const field = catalog[address.path] || {};
      const segment = segments?.get?.(address.segment) || {};
      return {
        path: address.path,
        found: Boolean(field.label || segment.name),
        title: field.label ? `${address.path} — ${field.label}` : address.path,
        datatype: field.datatype || '',
        detail: HINTS[address.path] || segment.purpose || 'No extra coach note for this field.',
        segmentName: segment.name || address.segment,
        preserved: /preserved/i.test(field.label || ''),
      };
    },
  };
}
