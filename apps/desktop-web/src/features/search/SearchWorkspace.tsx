import type { FormEvent } from "react";
import type { CoreCommandV1 } from "../../../../../shared/contracts/generated/contracts.v1.ts";

export type SearchResultSummary = {
  id: string;
  kind: "Knowledge" | "Project" | "Work" | "Source" | "Conversation";
  title: string;
  summary: string;
  evidenceRef?: string;
};

export function createSearchCommand(query: string, requestId: string): CoreCommandV1 {
  return {
    requestId,
    type: "SearchKnowledge",
    contractVersion: "v1",
    payload: { query },
  };
}

export type SearchWorkspaceProps = {
  results: readonly SearchResultSummary[];
  createRequestId: () => string;
  onSendCommand: (command: CoreCommandV1) => Promise<void>;
  onOpenEvidence?: (evidenceRef: string) => void;
};

export function SearchWorkspace({ results, createRequestId, onSendCommand, onOpenEvidence }: SearchWorkspaceProps) {
  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const field = event.currentTarget.elements.namedItem("query");
    const query = field && "value" in field ? String(field.value).trim() : "";
    if (query) await onSendCommand(createSearchCommand(query, createRequestId()));
  };

  const grouped = results.reduce<Map<SearchResultSummary["kind"], SearchResultSummary[]>>(
    (groups, result) => {
      const items = groups.get(result.kind) ?? [];
      items.push(result);
      groups.set(result.kind, items);
      return groups;
    },
    new Map(),
  );

  return (
    <section className="kairo-content search-workspace" data-testid="search-workspace" aria-label="Search">
      <header className="kairo-page-head"><div><p className="kairo-eyebrow">Global discovery</p><h1>Search all of Kairo</h1><p>Find knowledge, projects, work, sources, uploads, and remembered conversations.</p></div></header>
      <form className="global-search-form" onSubmit={submit}>
        <span aria-hidden="true">⌕</span><input name="query" type="search" aria-label="Search all of Kairo" placeholder="Search PACS support, go-live dates, systems, or prior troubleshooting" /><button type="submit">Search</button>
      </form>
      <div className="search-groups">
        {Array.from(grouped.entries()).map(([kind, items]) => (
          <section className="search-group" key={kind}><header><h2>{kind}</h2><span>{items.length}</span></header><div>{items.map((result) => (
            <button className="search-result" type="button" key={result.id} onClick={() => result.evidenceRef && onOpenEvidence?.(result.evidenceRef)}>
              <span className="search-result-icon">{result.kind.slice(0, 1)}</span><span><strong>{result.title}</strong><small>{result.summary}</small></span><em>{result.kind}</em>
            </button>
          ))}</div></section>
        ))}
      </div>
      {results.length === 0 ? <div className="empty-state"><strong>Search the whole workspace</strong><p>Results stay backed by Kairo Core and preserve their evidence source.</p></div> : null}
    </section>
  );
}
