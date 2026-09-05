import { flattenPaths } from './hl7-parser.mjs';

export function exactDiff(left, right) {
  if (left === right) return [];
  let start = 0;
  while (start < left.length && start < right.length && left[start] === right[start]) start += 1;
  let leftEnd = left.length;
  let rightEnd = right.length;
  while (leftEnd > start && rightEnd > start && left[leftEnd - 1] === right[rightEnd - 1]) { leftEnd -= 1; rightEnd -= 1; }
  return [{
    kind: leftEnd === start ? 'added' : rightEnd === start ? 'removed' : 'changed',
    leftStart: start, leftEnd, rightStart: start, rightEnd,
    before: left.slice(start, leftEnd), after: right.slice(start, rightEnd),
  }];
}

function canonicalValues(message) {
  return new Map([...flattenPaths(message)].map(([path, value]) => [path.includes('.') || /^MSH-[12]$/.test(path) ? path : path + '.1', value]));
}

function classifyDifference(left, right, path) {
  return !left.has(path) ? 'added' : !right.has(path) ? 'removed' : 'changed';
}

export function semanticDiff(left, right, { ignoredPaths = [] } = {}) {
  const leftValues = canonicalValues(left);
  const rightValues = canonicalValues(right);
  const paths = new Set([...leftValues.keys(), ...rightValues.keys()]);
  return [...paths]
    .filter((path) => !ignoredPaths.some((ignored) => path === ignored || path.startsWith(ignored + '.') || path.startsWith(ignored + '[')))
    .filter((path) => leftValues.get(path) !== rightValues.get(path))
    .map((path) => ({ path, before: leftValues.get(path), after: rightValues.get(path), kind: classifyDifference(leftValues, rightValues, path) }));
}
