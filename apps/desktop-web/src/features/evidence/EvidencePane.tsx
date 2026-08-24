export type EvidenceInspectionRecord = {
  evidenceRef: string;
  sourceId: string;
  sourceName: string;
  sourceType: string;
  mediaType: string | null;
  origin: string;
  classification: string;
  importedAt: string;
  contentHash: string;
  anchorDescription: string | null;
};

export type EvidencePaneProps = {
  evidenceRef: string;
  evidenceRecords?: readonly EvidenceInspectionRecord[];
};

export function EvidencePane({ evidenceRef, evidenceRecords = [] }: EvidencePaneProps) {
  const evidence = evidenceRecords.find((record) => record.evidenceRef === evidenceRef);

  return (
    <aside data-testid="evidence-pane" aria-label="Evidence">
      <h2>Evidence</h2>
      <div data-testid="source-anchor">{evidenceRef}</div>
      {evidence ? (
        <dl data-testid="evidence-provenance">
          <dt>Source</dt>
          <dd>{evidence.sourceName}</dd>
          <dt>Source ID</dt>
          <dd>{evidence.sourceId}</dd>
          <dt>Source type</dt>
          <dd>{evidence.sourceType}</dd>
          {evidence.mediaType ? (
            <>
              <dt>Media type</dt>
              <dd>{evidence.mediaType}</dd>
            </>
          ) : null}
          <dt>Origin</dt>
          <dd>{evidence.origin}</dd>
          <dt>Classification</dt>
          <dd>{evidence.classification}</dd>
          <dt>Imported</dt>
          <dd>{evidence.importedAt}</dd>
          <dt>Content hash</dt>
          <dd>{evidence.contentHash}</dd>
          {evidence.anchorDescription ? (
            <>
              <dt>Anchor</dt>
              <dd>{evidence.anchorDescription}</dd>
            </>
          ) : null}
        </dl>
      ) : (
        <p data-testid="evidence-unavailable">Evidence metadata is unavailable.</p>
      )}
    </aside>
  );
}
