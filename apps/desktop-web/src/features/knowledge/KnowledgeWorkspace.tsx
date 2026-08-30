export type KnowledgeSummary = {
  id: string;
  title: string;
  summary: string;
  evidenceState: string;
  evidenceRef?: string;
};

export type KnowledgeWorkspaceProps = {
  entries: readonly KnowledgeSummary[];
  onOpenEvidence?: (evidenceRef: string) => void;
};

export function KnowledgeWorkspace({ entries, onOpenEvidence }: KnowledgeWorkspaceProps) {
  return (
    <section className="kairo-content" data-testid="knowledge-workspace" aria-label="Knowledge">
      <header className="kairo-page-head"><div><p className="kairo-eyebrow">Living knowledge</p><h1>Knowledge</h1><p>Evidence-backed understanding stays separate from unapproved memory.</p></div></header>
      <div className="record-grid">
        {entries.map((entry) => (
          <article className="record-card" key={entry.id}>
            <span className="evidence-badge">{entry.evidenceState}</span>
            <h2>{entry.title}</h2><p>{entry.summary}</p>
            {entry.evidenceRef && onOpenEvidence ? <button type="button" onClick={() => onOpenEvidence(entry.evidenceRef!)}>Open evidence</button> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
