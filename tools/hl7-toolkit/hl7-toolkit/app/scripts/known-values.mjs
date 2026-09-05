// Session-only prefix index. Neither source values nor this index are persisted.
export function createKnownValueIndex() {
  const root = new Map();
  const word = (character) => Boolean(character && /[\p{L}\p{N}]/u.test(character));
  function set(value, replacement) {
    if (value.length < 3) return;
    let branch = root;
    for (const character of value) {
      const key = character.toLowerCase();
      if (!branch.has(key)) branch.set(key, new Map());
      branch = branch.get(key);
    }
    branch.replacement = replacement;
  }
  function matches(text, { boundaries = true } = {}) {
    const characters = Array.from(text);
    const offsets = []; let offset = 0;
    for (const character of characters) { offsets.push(offset); offset += character.length; }
    offsets.push(offset);
    const result = [];
    for (let start = 0; start < characters.length; start += 1) {
      if (boundaries && word(characters[start - 1])) continue;
      let branch = root; let match;
      for (let end = start; end < characters.length; end += 1) {
        branch = branch.get(characters[end].toLowerCase());
        if (!branch) break;
        if (branch.replacement !== undefined && (!boundaries || !word(characters[end + 1]))) {
          match = { index: offsets[start], length: offsets[end + 1] - offsets[start], replacement: branch.replacement, end };
        }
      }
      if (match) { result.push({ index: match.index, length: match.length, replacement: match.replacement }); start = match.end; }
    }
    return result;
  }
  function replace(text) {
    let position = 0; const output = [];
    for (const match of matches(text)) { output.push(text.slice(position, match.index), match.replacement); position = match.index + match.length; }
    output.push(text.slice(position));
    return output.join('');
  }
  return { set, matches, replace, clear: () => root.clear() };
}
