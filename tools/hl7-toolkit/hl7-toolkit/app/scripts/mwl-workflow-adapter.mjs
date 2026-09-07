const clone = value => structuredClone(value);

export function projectMwlTarget(snapshot) {
  if (!snapshot?.result || !snapshot.request) return { state: 'MWL_RESULT_REQUIRED', mode: '', generation: snapshot?.generation ?? 0, query: null, item: null };
  const { result } = snapshot;
  if (result.classification === 'SUCCESS_ZERO_MATCHES' && Array.isArray(result.items) && result.items.length === 0 && !result.matches?.truncated && result.cfind?.code === 'C_FIND_SUCCESS' && result.cfind?.dicomStatus === '0x0000') {
    return {
      state: 'READY', mode: 'ZERO_MATCH_QUERY_CONTEXT', generation: snapshot.generation,
      query: { endpoint: { host: snapshot.request.host, port: snapshot.request.port, callingAe: snapshot.request.callingAe, calledAe: snapshot.request.calledAe }, criteria: clone(snapshot.request.criteria ?? {}), result: { classification: result.classification, dns: clone(result.dns), tcp: clone(result.tcp), association: clone(result.association), cfind: clone(result.cfind), matchCount: 0 } },
      item: null,
    };
  }
  if (!/^SUCCESS_MATCHES/.test(result.classification ?? '') || !Array.isArray(result.items) || !result.items.length || result.matches?.truncated) return { state: 'MWL_RESULT_REQUIRED', mode: '', generation: snapshot.generation, query: null, item: null };
  if (!Number.isInteger(snapshot.selectedIndex) || snapshot.selectedIndex < 0 || snapshot.selectedIndex >= result.items.length) return { state: 'MWL_ITEM_SELECTION_REQUIRED', mode: '', generation: snapshot.generation, query: null, item: null };
  return {
    state: 'READY', mode: 'SELECTED_ITEM_COMPARISON', generation: snapshot.generation,
    query: { endpoint: { host: snapshot.request.host, port: snapshot.request.port, callingAe: snapshot.request.callingAe, calledAe: snapshot.request.calledAe }, criteria: clone(snapshot.request.criteria ?? {}), result: { classification: result.classification, dns: clone(result.dns), tcp: clone(result.tcp), association: clone(result.association), cfind: clone(result.cfind), matchCount: result.items.length } },
    item: clone(result.items[snapshot.selectedIndex]),
  };
}
