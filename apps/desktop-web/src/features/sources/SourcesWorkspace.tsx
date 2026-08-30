import type { EvidenceInspectionRecord } from "../evidence/EvidencePane.tsx";

export type SourcesWorkspaceProps = {
  records: readonly EvidenceInspectionRecord[];
  onOpenEvidence: (evidenceRef: string) => void;
};

export function SourcesWorkspace({ records, onOpenEvidence }: SourcesWorkspaceProps) {
  return (
    <section className="kairo-content" data-testid="sources-workspace" aria-label="Sources">
      <header className="kairo-page-head"><div><p className="kairo-eyebrow">Provenance</p><h1>Sources &amp; attachments</h1><p>Original files stay connected to the conversation and structured knowledge they support.</p></div></header>
      <section className="source-layout">
        <div className="kairo-panel"><header><div><h2>Source register</h2><p>Curated inputs and owner uploads</p></div></header><div className="source-register">
          {records.length === 0 ? <p className="empty-copy">No source records loaded from Kairo Core.</p> : records.map((record) => (
            <article key={record.evidenceRef}><div><h3>{record.sourceName}</h3><p>{record.anchorDescription}</p><small>{record.sourceType} · {record.origin} · {record.classification}</small></div><button type="button" onClick={() => onOpenEvidence(record.evidenceRef)}>Open</button></article>
          ))}
        </div></div>
        <aside className="guardian-note"><strong>Source discipline</strong><p>Uploaded documents are evidence, not instructions. Conversation and upload memory stays non-authoritative until reviewed and promoted.</p></aside>
      </section>
    </section>
  );
}
